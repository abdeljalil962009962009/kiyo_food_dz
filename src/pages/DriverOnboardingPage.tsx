import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Bike, Car, Check, FileText, Upload, X } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Spinner } from '../components/feedback';
import {
  removeUnsubmittedDriverDocuments,
  uploadDriverDocument,
  validateDriverDocument,
  type DriverDocumentType,
} from '../lib/driverDocuments';
import { normalizeAlgerianPhone } from '../lib/phone';
import { callUserAction } from '../lib/userApi';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { userFacingError } from '../lib/userFacingError';
import { supabase } from '../lib/supabase';

type VehicleType = 'bicycle' | 'motorcycle' | 'car' | 'scooter';
type Documents = Partial<Record<DriverDocumentType, File>>;
type DriverApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended';
type ExistingApplication = {
  application_status: DriverApplicationStatus;
  review_reason: string | null;
};

const VEHICLE_OPTIONS_KEYS: {
  value: VehicleType;
  labelKey: 'driver.vehicle.bicycle' | 'driver.vehicle.motorcycle' | 'driver.vehicle.scooter' | 'driver.vehicle.car';
  icon: typeof Bike;
  descKey: 'driver.vehicle.bicycle.desc' | 'driver.vehicle.motorcycle.desc' | 'driver.vehicle.scooter.desc' | 'driver.vehicle.car.desc';
}[] = [
  { value: 'bicycle', labelKey: 'driver.vehicle.bicycle', icon: Bike, descKey: 'driver.vehicle.bicycle.desc' },
  { value: 'motorcycle', labelKey: 'driver.vehicle.motorcycle', icon: Bike, descKey: 'driver.vehicle.motorcycle.desc' },
  { value: 'scooter', labelKey: 'driver.vehicle.scooter', icon: Bike, descKey: 'driver.vehicle.scooter.desc' },
  { value: 'car', labelKey: 'driver.vehicle.car', icon: Car, descKey: 'driver.vehicle.car.desc' },
];

const DOCUMENTS: {
  type: DriverDocumentType;
  labelKey:
    | 'driver.onboard.document.license'
    | 'driver.onboard.document.idCard'
    | 'driver.onboard.document.registration'
    | 'driver.onboard.document.insurance';
}[] = [
  { type: 'id_card', labelKey: 'driver.onboard.document.idCard' },
  { type: 'license', labelKey: 'driver.onboard.document.license' },
  { type: 'vehicle_registration', labelKey: 'driver.onboard.document.registration' },
  { type: 'insurance', labelKey: 'driver.onboard.document.insurance' },
];

function requiredDocuments(vehicle: VehicleType): DriverDocumentType[] {
  if (vehicle === 'bicycle') return ['id_card'];
  if (vehicle === 'car') return ['id_card', 'license', 'vehicle_registration', 'insurance'];
  return ['id_card', 'license', 'vehicle_registration'];
}

export default function DriverOnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, locale } = useT();
  const submissionKey = useRef(crypto.randomUUID());

  const [step, setStep] = useState(1);
  const [vehicleType, setVehicleType] = useState<VehicleType>('bicycle');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [documents, setDocuments] = useState<Documents>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkingApplication, setCheckingApplication] = useState(true);
  const [existingApplication, setExistingApplication] = useState<ExistingApplication | null>(null);

  const required = useMemo(() => requiredDocuments(vehicleType), [vehicleType]);
  const visibleDocuments = useMemo(
    () => DOCUMENTS.filter(({ type }) => required.includes(type) || type === 'insurance'),
    [required],
  );

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setCheckingApplication(false);
      return undefined;
    }
    void supabase
      .from('drivers')
      .select('application_status,review_reason')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) {
          setError(userFacingError(loadError, locale, t('driver.onboard.error.submit')));
        } else {
          setExistingApplication(data as ExistingApplication | null);
        }
        setCheckingApplication(false);
      });
    return () => { active = false; };
  }, [locale, t, user?.id]);

  const setDocument = (type: DriverDocumentType, file?: File) => {
    setError(null);
    if (!file) {
      setDocuments((current) => {
        const next = { ...current };
        delete next[type];
        return next;
      });
      return;
    }
    const validation = validateDriverDocument(file);
    if (validation === 'type') {
      setError(t('driver.onboard.error.fileType'));
      return;
    }
    if (validation === 'size') {
      setError(t('driver.onboard.error.fileSize'));
      return;
    }
    if (validation === 'empty') {
      setError(t('driver.onboard.error.fileEmpty'));
      return;
    }
    setDocuments((current) => ({ ...current, [type]: file }));
  };

  const validateDetails = useCallback(() => {
    if (idNumber.trim().length < 4) {
      setError(t('driver.onboard.error.identity'));
      return false;
    }
    if (vehicleType !== 'bicycle' && (
      vehiclePlate.trim().length < 4 || licenseNumber.trim().length < 4
    )) {
      setError(t('driver.onboard.error.vehicleDetails'));
      return false;
    }
    if (required.some((type) => !documents[type])) {
      setError(t('driver.onboard.error.documents'));
      return false;
    }
    return true;
  }, [documents, idNumber, required, t, vehiclePlate, vehicleType, licenseNumber]);

  const submitApplication = useCallback(async () => {
    if (!user || loading) return;
    const normalizedPhone = normalizeAlgerianPhone(phone);
    if (!normalizedPhone) {
      setError(t('checkout.invalidPhone'));
      return;
    }
    if (!validateDetails()) {
      setStep(2);
      return;
    }

    setLoading(true);
    setError(null);
    const uploadedPaths: string[] = [];
    try {
      const uploaded = [];
      for (const { type } of visibleDocuments) {
        const file = documents[type];
        if (!file) continue;
        const result = await uploadDriverDocument(user.id, type, file);
        uploaded.push(result);
        uploadedPaths.push(result.path);
      }

      const { data: rpcData, error: rpcError } = await callUserAction<{
        idempotent_replay?: boolean;
      }>('submit_driver_application', {
        p_payload: {
          vehicle_type: vehicleType,
          vehicle_plate: vehicleType === 'bicycle' ? null : vehiclePlate.trim().toUpperCase(),
          license_number: vehicleType === 'bicycle' ? null : licenseNumber.trim(),
          national_id_number: idNumber.trim(),
          phone: normalizedPhone,
          documents: uploaded,
        },
        p_submission_key: submissionKey.current,
      });
      if (rpcError) throw rpcError;
      if (rpcData?.idempotent_replay) {
        await removeUnsubmittedDriverDocuments(uploadedPaths);
      }
      setExistingApplication({ application_status: 'pending', review_reason: null });
      setSuccess(true);
    } catch (err) {
      await removeUnsubmittedDriverDocuments(uploadedPaths);
      setError(userFacingError(err, locale, t('driver.onboard.error.submit')));
    } finally {
      setLoading(false);
    }
  }, [
    documents, idNumber, licenseNumber, loading, locale, phone, t, user,
    validateDetails, vehiclePlate, vehicleType, visibleDocuments,
  ]);

  if (checkingApplication) {
    return (
      <AppShell>
        <div className="kiyo-card mx-auto flex min-h-40 max-w-md items-center justify-center p-8">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  if (success || existingApplication) {
    const status = existingApplication?.application_status ?? 'pending';
    const statusBody = status === 'under_review'
      ? t('driver.dash.applicationUnderReview')
      : status === 'rejected'
        ? t('driver.dash.applicationRejected')
        : status === 'suspended'
          ? t('driver.dash.applicationSuspended')
          : t('driver.onboard.success.body');
    return (
      <AppShell>
        <div className="kiyo-card mx-auto max-w-md p-8 text-center" role="status">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sage-100">
            <Check className="h-8 w-8 text-sage-600" />
          </div>
          <h2 className="font-display text-xl font-bold text-ink-900">
            {t('driver.onboard.success.title')}
          </h2>
          <p className="mt-2 text-sm text-ink-500">{statusBody}</p>
          {existingApplication?.review_reason && (
            <p className="mt-3 rounded-lg bg-warning-50 p-3 text-sm text-warning-800">
              <span className="font-semibold">{t('driver.dash.reviewReason')}:</span>{' '}
              {existingApplication.review_reason}
            </p>
          )}
          <button
            className="kiyo-btn-primary mt-6 w-full"
            onClick={() => navigate(
              status === 'approved'
                ? '/driver'
                : status === 'rejected' || status === 'suspended'
                  ? '/support'
                  : '/dashboard',
            )}
          >
            {status === 'rejected' || status === 'suspended'
              ? t('support.title')
              : t('driver.onboard.success.dashboard')}
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
            {t('driver.onboard.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{t('driver.onboard.subtitle')}</p>
        </div>

        <div className="mb-6 flex items-center gap-2" aria-label={t('driver.onboard.progress')}>
          {[1, 2, 3].map((value) => (
            <div
              key={value}
              className={`h-2 flex-1 rounded-full ${value <= step ? 'bg-ember-500' : 'bg-ink-200'}`}
            />
          ))}
        </div>

        <ErrorBoundary variant="inline">
          <div className="kiyo-card p-4 sm:p-6">
            {error && (
              <div
                className="mb-4 flex items-start gap-2 rounded-lg bg-error-55 p-3 text-sm text-error-600"
                role="alert"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === 1 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold text-ink-900">
                  {t('driver.onboard.step.vehicle')}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {VEHICLE_OPTIONS_KEYS.map((option) => {
                    const Icon = option.icon;
                    const selected = vehicleType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setVehicleType(option.value);
                          setError(null);
                        }}
                        className={`min-h-28 rounded-lg border-2 p-4 text-start transition ${
                          selected ? 'border-ember-500 bg-ember-50' : 'border-ink-200 hover:border-ink-300'
                        }`}
                        aria-pressed={selected}
                      >
                        <Icon className={`h-6 w-6 ${selected ? 'text-ember-500' : 'text-ink-400'}`} />
                        <div className="mt-2 font-medium text-ink-900">{t(option.labelKey)}</div>
                        <div className="text-xs text-ink-500">{t(option.descKey)}</div>
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setStep(2)} className="kiyo-btn-primary mt-6 w-full">
                  {t('common.continue')}
                </button>
              </section>
            )}

            {step === 2 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold text-ink-900">
                  {t('driver.onboard.step.details')}
                </h2>

                {vehicleType !== 'bicycle' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-ink-700">
                      {t('driver.onboard.licensePlate')}
                      <input
                        type="text"
                        value={vehiclePlate}
                        onChange={(event) => setVehiclePlate(event.target.value.toUpperCase())}
                        placeholder={t('driver.onboard.platePlaceholder')}
                        className="kiyo-input mt-1.5 w-full"
                        autoComplete="off"
                      />
                    </label>
                    <label className="block text-sm font-medium text-ink-700">
                      {t('driver.onboard.licenseNumber')}
                      <input
                        type="text"
                        value={licenseNumber}
                        onChange={(event) => setLicenseNumber(event.target.value)}
                        className="kiyo-input mt-1.5 w-full"
                        autoComplete="off"
                      />
                    </label>
                  </div>
                )}

                <label className="mt-4 block text-sm font-medium text-ink-700">
                  {t('driver.onboard.idNumber')}
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(event) => setIdNumber(event.target.value)}
                    className="kiyo-input mt-1.5 w-full"
                    autoComplete="off"
                  />
                </label>

                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-ink-800">
                    {t('driver.onboard.uploadDocuments')}
                  </h3>
                  <p className="mt-1 text-xs text-ink-500">{t('driver.onboard.uploadFormat')}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {visibleDocuments.map(({ type, labelKey }) => {
                      const file = documents[type];
                      const isRequired = required.includes(type);
                      const inputId = `driver-document-${type}`;
                      return (
                        <div key={type} className="rounded-lg border border-ink-200 p-3">
                          <div className="flex min-h-11 items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-ink-800">{t(labelKey)}</p>
                              <p className="text-xs text-ink-400">
                                {isRequired ? t('driver.onboard.required') : t('driver.onboard.optional')}
                              </p>
                            </div>
                            {file && (
                              <button
                                type="button"
                                onClick={() => setDocument(type)}
                                className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-50"
                                aria-label={t('driver.onboard.removeDocument')}
                              >
                                <X className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                          <input
                            id={inputId}
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp"
                            className="sr-only"
                            onChange={(event) => {
                              setDocument(type, event.target.files?.[0]);
                              event.target.value = '';
                            }}
                          />
                          <label
                            htmlFor={inputId}
                            className="mt-2 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-ink-300 px-3 py-2 text-sm text-ink-600 hover:border-ember-400 hover:text-ember-600"
                          >
                            {file ? <FileText className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                            <span className="min-w-0 truncate">
                              {file?.name ?? t('driver.onboard.chooseFile')}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                  <button type="button" onClick={() => setStep(1)} className="kiyo-btn-secondary flex-1">
                    {t('common.back')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      if (validateDetails()) setStep(3);
                    }}
                    className="kiyo-btn-primary flex-1"
                  >
                    {t('common.continue')}
                  </button>
                </div>
              </section>
            )}

            {step === 3 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold text-ink-900">
                  {t('driver.onboard.contactTitle')}
                </h2>
                <label className="block text-sm font-medium text-ink-700">
                  {t('driver.onboard.phone')} <span className="text-error-500">*</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+213 5 00 00 00 00"
                    className="kiyo-input mt-1.5 w-full"
                    autoComplete="tel"
                    dir="ltr"
                    required
                  />
                </label>
                <p className="mt-1 text-xs text-ink-400">{t('driver.onboard.phoneHelp')}</p>

                <div className="mt-5 rounded-lg bg-ink-50 p-4">
                  <h3 className="text-sm font-semibold text-ink-900">{t('driver.onboard.summary')}</h3>
                  <div className="mt-2 space-y-1 text-sm text-ink-600">
                    <p><span className="font-medium">{t('driver.onboard.vehicle')}:</span> {t(`driver.vehicle.${vehicleType}` as 'driver.vehicle.bicycle')}</p>
                    {vehiclePlate && <p><span className="font-medium">{t('driver.onboard.plate')}:</span> {vehiclePlate}</p>}
                    <p><span className="font-medium">{t('driver.onboard.id')}:</span> {idNumber}</p>
                    <p><span className="font-medium">{t('driver.onboard.documents')}:</span> {Object.keys(documents).length}</p>
                  </div>
                </div>

                <p className="mt-4 rounded-lg border border-sage-200 bg-sage-50 p-3 text-sm text-sage-800">
                  {t('driver.onboard.reviewNotice')}
                </p>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                  <button type="button" onClick={() => setStep(2)} className="kiyo-btn-secondary flex-1" disabled={loading}>
                    {t('common.back')}
                  </button>
                  <button
                    type="button"
                    onClick={submitApplication}
                    disabled={loading || !phone.trim()}
                    className="kiyo-btn-primary min-h-11 flex-1"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner size="sm" /> {t('driver.onboard.uploading')}
                      </span>
                    ) : t('driver.onboard.submit')}
                  </button>
                </div>
              </section>
            )}
          </div>
        </ErrorBoundary>
      </div>
    </AppShell>
  );
}
