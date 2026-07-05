import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, Car, FileText, Upload, Check, AlertCircle } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Spinner } from '../components/feedback';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';

type VehicleType = 'bicycle' | 'motorcycle' | 'car' | 'scooter';

const VEHICLE_OPTIONS_KEYS: { value: VehicleType; labelKey: 'driver.vehicle.bicycle' | 'driver.vehicle.motorcycle' | 'driver.vehicle.scooter' | 'driver.vehicle.car'; icon: typeof Bike; descKey: 'driver.vehicle.bicycle.desc' | 'driver.vehicle.motorcycle.desc' | 'driver.vehicle.scooter.desc' | 'driver.vehicle.car.desc' }[] = [
  { value: 'bicycle', labelKey: 'driver.vehicle.bicycle', icon: Bike, descKey: 'driver.vehicle.bicycle.desc' },
  { value: 'motorcycle', labelKey: 'driver.vehicle.motorcycle', icon: Bike, descKey: 'driver.vehicle.motorcycle.desc' },
  { value: 'scooter', labelKey: 'driver.vehicle.scooter', icon: Bike, descKey: 'driver.vehicle.scooter.desc' },
  { value: 'car', labelKey: 'driver.vehicle.car', icon: Car, descKey: 'driver.vehicle.car.desc' },
];

export default function DriverOnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();

  const [step, setStep] = useState(1);
  const [vehicleType, setVehicleType] = useState<VehicleType>('bicycle');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [documents, setDocuments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocuments(Array.from(e.target.files));
    }
  };

  const submitApplication = useCallback(async () => {
    if (!user) return;
    if (!phone.trim()) {
      setError(t('checkout.invalidPhone'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if driver already exists
      const { data: existing } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Already applied - redirect to dashboard
        navigate('/driver', { replace: true });
        return;
      }

      // Create driver record
      const { error: insertError } = await supabase
        .from('drivers')
        .insert({
          user_id: user.id,
          vehicle_type: vehicleType,
          vehicle_plate: vehiclePlate || null,
          is_online: false,
          is_verified: false,
          is_active: true,
          rating: 5.0,
          delivery_count: 0,
        });

      if (insertError) throw insertError;

      // Update profile phone
      await supabase
        .from('profiles')
        .update({ phone: phone.trim() })
        .eq('id', user.id);

      // If documents were uploaded, we'd handle them here
      // For now, just mark as success
      setSuccess(true);

      // Redirect to driver dashboard after 3 seconds
      setTimeout(() => {
        navigate('/driver', { replace: true });
      }, 3000);
    } catch (err) {
      setError((err as Error)?.message ?? t('auth.error.unknown'));
    } finally {
      setLoading(false);
    }
  }, [user, vehicleType, vehiclePlate, phone, navigate, t]);

  if (success) {
    return (
      <AppShell>
        <div className="kiyo-card mx-auto max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sage-100">
            <Check className="h-8 w-8 text-sage-600" />
          </div>
          <h2 className="font-display text-xl font-bold text-ink-900">{t('driver.onboard.success.title')}</h2>
          <p className="mt-2 text-sm text-ink-500">
            {t('driver.onboard.success.body')}
          </p>
          <p className="mt-4 text-xs text-ink-400">{t('driver.onboard.success.redirect')}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
            {t('driver.onboard.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {t('driver.onboard.subtitle')}
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full ${
                s <= step ? 'bg-ember-500' : 'bg-ink-200'
              }`}
            />
          ))}
        </div>

        <ErrorBoundary variant="inline">
          <div className="kiyo-card p-6">
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-error-55 p-3 text-sm text-error-600">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Step 1: Vehicle Selection */}
            {step === 1 && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-ink-900">{t('driver.onboard.step.vehicle')}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {VEHICLE_OPTIONS_KEYS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = vehicleType === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setVehicleType(option.value)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          isSelected
                            ? 'border-ember-500 bg-ember-50'
                            : 'border-ink-200 hover:border-ink-300'
                        }`}
                      >
                        <Icon className={`h-6 w-6 ${isSelected ? 'text-ember-500' : 'text-ink-400'}`} />
                        <div className="mt-2 font-medium text-ink-900">{t(option.labelKey)}</div>
                        <div className="text-xs text-ink-500">{t(option.descKey)}</div>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="kiyo-btn-primary mt-6 w-full"
                >
                  {t('common.continue')}
                </button>
              </div>
            )}

            {/* Step 2: Vehicle Details & Documents */}
            {step === 2 && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-ink-900">{t('driver.onboard.step.details')}</h2>

                {['car', 'motorcycle', 'scooter'].includes(vehicleType) && (
                  <div className="mb-4">
                    <label className="mb-1.5 block text-sm font-medium text-ink-700">
                      {t('driver.onboard.licensePlate')}
                    </label>
                    <input
                      type="text"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                      placeholder="e.g., 12345-678-90"
                      className="kiyo-input w-full"
                    />
                  </div>
                )}

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    {t('driver.onboard.licenseNumber')}
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="Your license number"
                    className="kiyo-input w-full"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    {t('driver.onboard.idNumber')}
                  </label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="Your national ID"
                    className="kiyo-input w-full"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    {t('driver.onboard.uploadDocuments')}
                  </label>
                  <div className="rounded-lg border-2 border-dashed border-ink-200 p-6 text-center">
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      id="documents-upload"
                    />
                    <label
                      htmlFor="documents-upload"
                      className="cursor-pointer"
                    >
                      <Upload className="mx-auto h-8 w-8 text-ink-300" />
                      <p className="mt-2 text-sm text-ink-500">
                        {t('driver.onboard.uploadPrompt')}
                      </p>
                      <p className="text-xs text-ink-400">{t('driver.onboard.uploadFormat')}</p>
                    </label>
                  </div>
                  {documents.length > 0 && (
                    <div className="mt-2 text-sm text-ink-600">
                      {documents.map((f) => (
                        <div key={f.name} className="flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          {f.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="kiyo-btn-secondary flex-1"
                  >
                    {t('common.back')}
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="kiyo-btn-primary flex-1"
                  >
                    {t('common.continue')}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Contact & Submit */}
            {step === 3 && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-ink-900">{t('driver.onboard.contactTitle')}</h2>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    {t('driver.onboard.phone')} <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+213 XX XXX XX XX"
                    className="kiyo-input w-full"
                    required
                  />
                  <p className="mt-1 text-xs text-ink-400">
                    {t('driver.onboard.phoneHelp')}
                  </p>
                </div>

                <div className="mb-6 rounded-lg bg-ink-50 p-4">
                  <h3 className="text-sm font-semibold text-ink-900">{t('driver.onboard.summary')}</h3>
                  <div className="mt-2 space-y-1 text-sm text-ink-600">
                    <p><span className="font-medium">{t('driver.onboard.vehicle')}:</span> {t(`driver.vehicle.${vehicleType}` as 'driver.vehicle.bicycle')}</p>
                    {vehiclePlate && <p><span className="font-medium">{t('driver.onboard.plate')}:</span> {vehiclePlate}</p>}
                    {licenseNumber && <p><span className="font-medium">{t('driver.onboard.license')}:</span> {licenseNumber}</p>}
                    {idNumber && <p><span className="font-medium">{t('driver.onboard.id')}:</span> {idNumber}</p>}
                    {documents.length > 0 && (
                      <p><span className="font-medium">{t('driver.onboard.documents')}:</span> {documents.length}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="kiyo-btn-secondary flex-1"
                  >
                    {t('common.back')}
                  </button>
                  <button
                    onClick={submitApplication}
                    disabled={loading || !phone.trim()}
                    className="kiyo-btn-primary flex-1"
                  >
                    {loading ? <Spinner size="sm" /> : t('driver.onboard.submit')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </ErrorBoundary>
      </div>
    </AppShell>
  );
}
