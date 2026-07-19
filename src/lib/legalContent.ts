import type { Locale } from './i18n';

export type LegalDocumentId = 'terms' | 'privacy' | 'refund' | 'restaurantAgreement' | 'cookies' | 'accountDeletion';

export type LegalDocument = {
  title: string;
  lastUpdated: string;
  sections: Array<{ heading: string; body: string }>;
};

export const legalUi: Record<Locale, { legal: string; back: string; lastUpdated: string; notice: string }> = {
  en: {
    legal: 'Legal information',
    back: 'Back',
    lastUpdated: 'Last updated',
    notice: 'These terms explain how Kiyo Food operates. Contact support if you need help understanding a section.',
  },
  fr: {
    legal: 'Informations juridiques',
    back: 'Retour',
    lastUpdated: 'Dernière mise à jour',
    notice: 'Ces conditions expliquent le fonctionnement de Kiyo Food. Contactez le support si une section nécessite des précisions.',
  },
  ar: {
    legal: 'المعلومات القانونية',
    back: 'رجوع',
    lastUpdated: 'آخر تحديث',
    notice: 'توضح هذه الشروط طريقة عمل كيو فود. تواصل مع الدعم إذا احتجت إلى توضيح أي بند.',
  },
};

const UPDATED = {
  en: '18 July 2026',
  fr: '18 juillet 2026',
  ar: '18 يوليو 2026',
} as const;
export const legalDocuments: Record<Locale, Record<LegalDocumentId, LegalDocument>> = {
  en: {
    terms: {
      title: 'Terms of Use', lastUpdated: UPDATED.en,
      sections: [
        { heading: '1. Acceptance', body: 'By using Kiyo Food, you agree to these terms. If you do not agree, do not place an order or use an account.' },
        { heading: '2. Platform role', body: 'Kiyo Food is a marketplace connecting customers with independent restaurants. Restaurants remain responsible for food preparation, quality, packaging and their delivery operations.' },
        { heading: '3. Orders and payment', body: 'Kiyo Food currently supports Cash on Delivery. The server validates item prices, delivery charges, availability and the final total when an order is placed. Attempts to alter prices or fees may cause the order to be rejected.' },
        { heading: '4. Account responsibility', body: 'Keep your credentials private and provide accurate contact and delivery information. Kiyo Food may restrict accounts involved in fraud, abuse or repeated harmful conduct.' },
        { heading: '5. Availability and changes', body: 'Restaurant availability, menu items and delivery coverage can change. Kiyo Food may update these terms and will communicate material changes where required.' },
        { heading: '6. Help', body: 'Use the support area from your account or order page when an order, account or delivery issue needs review.' },
      ],
    },
    privacy: {
      title: 'Privacy Policy', lastUpdated: UPDATED.en,
      sections: [
        { heading: '1. Information we collect', body: 'We collect the account, contact, order and precise delivery information needed to provide the service. Location permission is optional because an address can also be entered manually.' },
        { heading: '2. How information is used', body: 'Information is used to authenticate accounts, create and deliver orders, provide support, prevent fraud and meet legal obligations. Kiyo Food does not sell personal data.' },
        { heading: '3. Restaurant and driver access', body: 'Restaurants and authorized delivery participants receive only the information needed to prepare and deliver an active order. They cannot browse unrelated customers or orders.' },
        { heading: '4. Storage and protection', body: 'Access is restricted by role and database security policies. Exact addresses and coordinates are treated as private delivery data.' },
        { heading: '5. Your choices', body: 'You can correct profile and address information, request a personal-data export or request account deletion from your profile, subject to lawful financial-record retention.' },
        { heading: '6. Support', body: 'Contact Kiyo Food support for privacy questions or to exercise a data right that is not available directly in your profile.' },
      ],
    },
    refund: {
      title: 'Cancellation and Refund Policy', lastUpdated: UPDATED.en,
      sections: [
        { heading: '1. Customer cancellation', body: 'A customer can cancel directly while the order is still awaiting restaurant confirmation. After preparation starts, support must review the request because food may already have been prepared.' },
        { heading: '2. Cash on Delivery', body: 'Kiyo Food does not collect money online for a Cash-on-Delivery order. A cancellation before payment therefore does not require an electronic refund.' },
        { heading: '3. Restaurant cancellation', body: 'If a restaurant cannot fulfil an order, the customer is notified and no Cash-on-Delivery amount is due for that cancelled order.' },
        { heading: '4. Missing, incorrect or undelivered items', body: 'Report the problem from the order support action as soon as possible and include the order number and clear details. Kiyo Food will review it with the restaurant.' },
        { heading: '5. Money already paid', body: 'If cash was handed over for an incomplete, cancelled or undelivered order, contact support immediately. Kiyo Food will document the case and coordinate a fair resolution with the responsible restaurant.' },
        { heading: '6. Food-safety concerns', body: 'Food-safety reports are escalated for urgent review and may result in restaurant restrictions or suspension.' },
      ],
    },
    restaurantAgreement: {
      title: 'Restaurant Partnership Agreement', lastUpdated: UPDATED.en,
      sections: [
        { heading: '1. Relationship', body: 'This agreement applies between Kiyo Food and the approved restaurant partner linked to the restaurant account.' },
        { heading: '2. Partner responsibilities', body: 'The partner is responsible for legal compliance, food safety, menu accuracy, prices, stock, preparation, packaging, service hours and any delivery personnel it manages.' },
        { heading: '3. Approval and publication', body: 'Application approval permits setup but does not automatically publish a restaurant. Public visibility requires a separate readiness review and publish decision by Kiyo Food.' },
        { heading: '4. Commercial terms', body: 'Commission, delivery-revenue participation and other charges are governed by the currently approved, versioned commercial agreement shown in the restaurant workspace. A proposed rate is never active until it is approved through the platform workflow.' },
        { heading: '5. Financial history', body: 'Each order keeps the financial rules and amounts used when it was placed. Later rule changes apply only according to their effective dates and do not rewrite previous order records.' },
        { heading: '6. Customer information', body: 'Customer information may be used only to prepare, deliver and support the related order. It must not be retained or reused for unrelated purposes.' },
        { heading: '7. Suspension and termination', body: 'Kiyo Food may pause, suspend or unpublish a restaurant for safety, fraud, compliance or serious service issues. Existing valid orders and financial records remain traceable.' },
      ],
    },
    cookies: {
      title: 'Cookie and Local Storage Policy', lastUpdated: UPDATED.en,
      sections: [
        { heading: '1. Essential storage', body: 'Kiyo Food uses essential browser storage for authentication, security, language, cart continuity and saved interface preferences.' },
        { heading: '2. Cart and language', body: 'Cart contents and language preference may be kept on the device so a refresh or temporary connection loss does not erase progress.' },
        { heading: '3. Third-party services', body: 'Authentication and map providers may use their own cookies or storage under their privacy policies when those services are used.' },
        { heading: '4. Analytics', body: 'Non-essential analytics must respect the consent choices displayed by Kiyo Food and must not receive exact addresses, phone numbers or private delivery instructions.' },
        { heading: '5. Managing storage', body: 'Browser settings can clear cookies and local storage. Doing so may sign you out and remove the locally saved cart and preferences.' },
      ],
    },
    accountDeletion: {
      title: 'Account Deletion Policy', lastUpdated: UPDATED.en,
      sections: [
        { heading: '1. Requesting deletion', body: 'You may request account deletion from your profile. The interface explains any grace period and restrictions before you confirm.' },
        { heading: '2. Personal information', body: 'Profile, saved-address and other deletable personal records are removed or anonymized according to the deletion workflow.' },
        { heading: '3. Required retention', body: 'Orders, settlements and immutable financial records may be retained for legal, tax, accounting, fraud-prevention and dispute purposes, while personal links are minimized where possible.' },
        { heading: '4. Restaurant accounts', body: 'An account responsible for an active restaurant may require an ownership transfer, closure or support review before deletion.' },
        { heading: '5. Data export', body: 'Request a copy of your personal data before deletion if you want to keep it.' },
      ],
    },
  },
  fr: {
    terms: {
      title: 'Conditions d’utilisation', lastUpdated: UPDATED.fr,
      sections: [
        { heading: '1. Acceptation', body: 'En utilisant Kiyo Food, vous acceptez ces conditions. Si vous ne les acceptez pas, ne passez pas de commande et n’utilisez pas de compte.' },
        { heading: '2. Rôle de la plateforme', body: 'Kiyo Food est une place de marché qui met en relation les clients et des restaurants indépendants. Les restaurants restent responsables de la préparation, de la qualité, de l’emballage et de leurs opérations de livraison.' },
        { heading: '3. Commandes et paiement', body: 'Kiyo Food prend actuellement en charge le paiement à la livraison. Le serveur vérifie les prix, les frais de livraison, la disponibilité et le total final lors de la commande. Toute tentative de modification peut entraîner le rejet de la commande.' },
        { heading: '4. Responsabilité du compte', body: 'Gardez vos identifiants confidentiels et fournissez des coordonnées et une adresse exactes. Kiyo Food peut restreindre les comptes liés à la fraude, aux abus ou à des comportements nuisibles répétés.' },
        { heading: '5. Disponibilité et modifications', body: 'La disponibilité des restaurants, les menus et la couverture peuvent changer. Kiyo Food peut mettre à jour ces conditions et communiquera les changements importants lorsque cela est requis.' },
        { heading: '6. Assistance', body: 'Utilisez l’assistance depuis votre compte ou la page de commande lorsqu’un problème doit être examiné.' },
      ],
    },
    privacy: {
      title: 'Politique de confidentialité', lastUpdated: UPDATED.fr,
      sections: [
        { heading: '1. Informations collectées', body: 'Nous collectons les informations de compte, de contact, de commande et de livraison précise nécessaires au service. La permission de localisation reste facultative, car une adresse peut être saisie manuellement.' },
        { heading: '2. Utilisation des informations', body: 'Les données servent à authentifier les comptes, traiter et livrer les commandes, fournir l’assistance, prévenir la fraude et respecter les obligations légales. Kiyo Food ne vend pas les données personnelles.' },
        { heading: '3. Accès des restaurants et livreurs', body: 'Les restaurants et intervenants autorisés reçoivent uniquement les informations utiles à la commande active. Ils ne peuvent pas consulter les autres clients ou commandes.' },
        { heading: '4. Stockage et protection', body: 'L’accès est limité selon le rôle et les politiques de sécurité de la base de données. Les adresses et coordonnées exactes sont des données de livraison privées.' },
        { heading: '5. Vos choix', body: 'Vous pouvez corriger votre profil et vos adresses, demander un export ou demander la suppression du compte, sous réserve de la conservation légale des documents financiers.' },
        { heading: '6. Assistance', body: 'Contactez le support Kiyo Food pour toute question de confidentialité ou demande indisponible directement dans votre profil.' },
      ],
    },
    refund: {
      title: 'Politique d’annulation et de remboursement', lastUpdated: UPDATED.fr,
      sections: [
        { heading: '1. Annulation par le client', body: 'Le client peut annuler directement tant que le restaurant n’a pas confirmé. Une fois la préparation commencée, le support doit examiner la demande car le repas peut déjà être en préparation.' },
        { heading: '2. Paiement à la livraison', body: 'Kiyo Food n’encaisse aucun paiement en ligne pour une commande payée à la livraison. Une annulation avant paiement ne nécessite donc aucun remboursement électronique.' },
        { heading: '3. Annulation par le restaurant', body: 'Si le restaurant ne peut pas exécuter la commande, le client est informé et aucun montant n’est dû pour cette commande annulée.' },
        { heading: '4. Article manquant, incorrect ou non livré', body: 'Signalez rapidement le problème depuis l’assistance de la commande avec le numéro et des détails clairs. Kiyo Food l’examinera avec le restaurant.' },
        { heading: '5. Espèces déjà versées', body: 'Si des espèces ont été remises pour une commande incomplète, annulée ou non livrée, contactez immédiatement le support. Kiyo Food documentera le dossier et coordonnera une solution équitable.' },
        { heading: '6. Sécurité alimentaire', body: 'Les signalements liés à la sécurité alimentaire sont examinés en urgence et peuvent entraîner une restriction ou une suspension du restaurant.' },
      ],
    },
    restaurantAgreement: {
      title: 'Accord de partenariat restaurant', lastUpdated: UPDATED.fr,
      sections: [
        { heading: '1. Relation', body: 'Cet accord s’applique entre Kiyo Food et le partenaire approuvé associé au compte du restaurant.' },
        { heading: '2. Responsabilités du partenaire', body: 'Le partenaire est responsable de la conformité légale, de la sécurité alimentaire, du menu, des prix, du stock, de la préparation, de l’emballage, des horaires et du personnel de livraison qu’il gère.' },
        { heading: '3. Approbation et publication', body: 'L’approbation de la demande autorise la configuration mais ne publie pas automatiquement le restaurant. La visibilité publique exige une vérification distincte et une décision de publication de Kiyo Food.' },
        { heading: '4. Conditions commerciales', body: 'La commission, la participation aux revenus de livraison et les autres frais suivent l’accord commercial versionné et approuvé affiché dans l’espace restaurant. Un taux proposé n’est jamais actif avant son approbation dans le workflow de la plateforme.' },
        { heading: '5. Historique financier', body: 'Chaque commande conserve les règles et montants utilisés lors de sa création. Les modifications ultérieures suivent leur date d’effet et ne réécrivent pas les anciennes commandes.' },
        { heading: '6. Données client', body: 'Les données client servent uniquement à préparer, livrer et assister la commande concernée. Elles ne doivent pas être conservées ou réutilisées à d’autres fins.' },
        { heading: '7. Suspension et fin du partenariat', body: 'Kiyo Food peut mettre en pause, suspendre ou dépublier un restaurant pour des raisons de sécurité, fraude, conformité ou service grave. Les commandes et documents financiers valides restent traçables.' },
      ],
    },
    cookies: {
      title: 'Politique relative aux cookies et au stockage local', lastUpdated: UPDATED.fr,
      sections: [
        { heading: '1. Stockage essentiel', body: 'Kiyo Food utilise le stockage essentiel du navigateur pour l’authentification, la sécurité, la langue, la continuité du panier et les préférences d’interface.' },
        { heading: '2. Panier et langue', body: 'Le panier et la langue peuvent rester sur l’appareil afin qu’une actualisation ou une coupure temporaire n’efface pas votre progression.' },
        { heading: '3. Services tiers', body: 'Les fournisseurs d’authentification et de cartes peuvent utiliser leurs propres cookies ou stockage selon leurs politiques lorsque vous utilisez ces services.' },
        { heading: '4. Mesure d’audience', body: 'Toute mesure non essentielle doit respecter le consentement affiché par Kiyo Food et ne doit pas recevoir d’adresse exacte, de téléphone ou d’instructions privées.' },
        { heading: '5. Gestion du stockage', body: 'Vous pouvez effacer les cookies et le stockage local depuis le navigateur. Cela peut vous déconnecter et supprimer le panier et les préférences conservés localement.' },
      ],
    },
    accountDeletion: {
      title: 'Politique de suppression du compte', lastUpdated: UPDATED.fr,
      sections: [
        { heading: '1. Demander la suppression', body: 'Vous pouvez demander la suppression depuis votre profil. L’interface explique le délai éventuel et les restrictions avant confirmation.' },
        { heading: '2. Informations personnelles', body: 'Le profil, les adresses enregistrées et les autres données personnelles supprimables sont effacés ou anonymisés selon le workflow.' },
        { heading: '3. Conservation obligatoire', body: 'Les commandes, règlements et documents financiers immuables peuvent être conservés pour les obligations légales, fiscales, comptables, la prévention de la fraude et les litiges, en limitant les liens personnels lorsque possible.' },
        { heading: '4. Comptes restaurant', body: 'Un compte responsable d’un restaurant actif peut nécessiter un transfert de propriété, une fermeture ou un examen du support avant suppression.' },
        { heading: '5. Export des données', body: 'Demandez une copie de vos données personnelles avant la suppression si vous souhaitez les conserver.' },
      ],
    },
  },
  ar: {
    terms: {
      title: 'شروط الاستخدام', lastUpdated: UPDATED.ar,
      sections: [
        { heading: '1. الموافقة', body: 'باستخدام كيو فود، فإنك توافق على هذه الشروط. إذا لم توافق عليها، فلا تنشئ طلباً ولا تستخدم حساباً.' },
        { heading: '2. دور المنصة', body: 'كيو فود منصة تربط العملاء بمطاعم مستقلة. يبقى المطعم مسؤولاً عن تحضير الطعام وجودته وتغليفه وعمليات التوصيل التابعة له.' },
        { heading: '3. الطلبات والدفع', body: 'تعتمد كيو فود حالياً الدفع عند التوصيل. يتحقق الخادم عند إنشاء الطلب من أسعار المنتجات ورسوم التوصيل والتوفر والمبلغ النهائي. قد يؤدي التلاعب بالأسعار أو الرسوم إلى رفض الطلب.' },
        { heading: '4. مسؤولية الحساب', body: 'حافظ على سرية بيانات الدخول وأدخل معلومات اتصال وتوصيل صحيحة. يمكن لكيو فود تقييد الحسابات المرتبطة بالاحتيال أو الإساءة أو السلوك الضار المتكرر.' },
        { heading: '5. التوفر والتغييرات', body: 'قد يتغير توفر المطاعم والقوائم ومناطق التوصيل. يمكن تحديث هذه الشروط مع إشعار المستخدمين بالتغييرات المهمة عند الحاجة.' },
        { heading: '6. المساعدة', body: 'استخدم الدعم من حسابك أو من صفحة الطلب عندما تحتاج مشكلة في الطلب أو الحساب أو التوصيل إلى مراجعة.' },
      ],
    },
    privacy: {
      title: 'سياسة الخصوصية', lastUpdated: UPDATED.ar,
      sections: [
        { heading: '1. المعلومات التي نجمعها', body: 'نجمع بيانات الحساب والاتصال والطلب وموقع التوصيل الدقيق اللازمة لتقديم الخدمة. إذن الموقع اختياري، إذ يمكنك إدخال العنوان يدوياً.' },
        { heading: '2. استخدام المعلومات', body: 'نستخدم البيانات لتسجيل الدخول وإنشاء الطلبات وتوصيلها وتقديم الدعم ومنع الاحتيال والالتزام بالقانون. لا تبيع كيو فود البيانات الشخصية.' },
        { heading: '3. وصول المطعم والمُوصل', body: 'يحصل المطعم وأطراف التوصيل المصرح لهم فقط على المعلومات اللازمة للطلب النشط. ولا يمكنهم تصفح عملاء أو طلبات أخرى.' },
        { heading: '4. التخزين والحماية', body: 'يتم تقييد الوصول حسب الدور وبسياسات أمان قاعدة البيانات. العناوين والإحداثيات الدقيقة بيانات توصيل خاصة.' },
        { heading: '5. خياراتك', body: 'يمكنك تصحيح ملفك وعناوينك وطلب نسخة من بياناتك أو حذف الحساب، مع مراعاة مدة الاحتفاظ القانونية بالسجلات المالية.' },
        { heading: '6. الدعم', body: 'تواصل مع دعم كيو فود للاستفسارات المتعلقة بالخصوصية أو لتنفيذ حق غير متاح مباشرة في ملفك.' },
      ],
    },
    refund: {
      title: 'سياسة الإلغاء واسترداد المبالغ', lastUpdated: UPDATED.ar,
      sections: [
        { heading: '1. إلغاء العميل', body: 'يمكن للعميل إلغاء الطلب مباشرة ما دام بانتظار تأكيد المطعم. بعد بدء التحضير، يجب أن يراجع الدعم الطلب لأن الطعام قد يكون قيد التحضير.' },
        { heading: '2. الدفع عند التوصيل', body: 'لا تحصّل كيو فود مبلغاً عبر الإنترنت لطلب الدفع عند التوصيل. لذلك لا يحتاج الإلغاء قبل الدفع إلى استرداد إلكتروني.' },
        { heading: '3. إلغاء المطعم', body: 'إذا تعذر على المطعم تنفيذ الطلب، يتم إبلاغ العميل ولا يكون عليه دفع أي مبلغ لذلك الطلب الملغى.' },
        { heading: '4. منتج ناقص أو خاطئ أو لم يصل', body: 'أبلغ عن المشكلة سريعاً من دعم الطلب مع رقم الطلب وتفاصيل واضحة. ستراجعها كيو فود مع المطعم.' },
        { heading: '5. مبلغ دُفع مسبقاً', body: 'إذا تم تسليم مبلغ نقدي لطلب ناقص أو ملغى أو لم يصل، فتواصل مع الدعم فوراً. ستوثق كيو فود الحالة وتنسق حلاً عادلاً مع المطعم المسؤول.' },
        { heading: '6. سلامة الطعام', body: 'تتم مراجعة بلاغات سلامة الطعام بشكل عاجل وقد تؤدي إلى تقييد المطعم أو تعليقه.' },
      ],
    },
    restaurantAgreement: {
      title: 'اتفاقية شراكة المطعم', lastUpdated: UPDATED.ar,
      sections: [
        { heading: '1. العلاقة', body: 'تطبق هذه الاتفاقية بين كيو فود وشريك المطعم المعتمد المرتبط بحساب المطعم.' },
        { heading: '2. مسؤوليات الشريك', body: 'الشريك مسؤول عن الالتزام القانوني وسلامة الطعام ودقة القائمة والأسعار والمخزون والتحضير والتغليف وساعات العمل وأفراد التوصيل الذين يديرهم.' },
        { heading: '3. الموافقة والنشر', body: 'الموافقة على الطلب تسمح بإعداد المطعم لكنها لا تنشره تلقائياً. الظهور للعملاء يتطلب مراجعة جاهزية مستقلة وقرار نشر من كيو فود.' },
        { heading: '4. الشروط التجارية', body: 'تخضع العمولة والمشاركة في إيرادات التوصيل والرسوم الأخرى للاتفاق التجاري المعتمد ذي النسخ والمبين في مساحة المطعم. لا يصبح السعر المقترح فعالاً قبل اعتماده عبر نظام المنصة.' },
        { heading: '5. السجل المالي', body: 'يحتفظ كل طلب بالقواعد والمبالغ المستخدمة وقت إنشائه. تطبق التغييرات اللاحقة حسب تاريخ سريانها ولا تعيد كتابة سجلات الطلبات السابقة.' },
        { heading: '6. بيانات العميل', body: 'تستخدم بيانات العميل فقط لتحضير الطلب المرتبط وتوصيله ودعمه. ولا يجوز الاحتفاظ بها أو إعادة استخدامها لغرض آخر.' },
        { heading: '7. التعليق وإنهاء الشراكة', body: 'يمكن لكيو فود إيقاف المطعم مؤقتاً أو تعليقه أو إلغاء نشره لأسباب السلامة أو الاحتيال أو الالتزام أو مشاكل الخدمة الخطيرة. تبقى الطلبات والسجلات المالية الصحيحة قابلة للتتبع.' },
      ],
    },
    cookies: {
      title: 'سياسة ملفات الارتباط والتخزين المحلي', lastUpdated: UPDATED.ar,
      sections: [
        { heading: '1. التخزين الضروري', body: 'تستخدم كيو فود تخزين المتصفح الضروري لتسجيل الدخول والأمان واللغة واستمرار السلة وتفضيلات الواجهة.' },
        { heading: '2. السلة واللغة', body: 'يمكن حفظ السلة واللغة على الجهاز حتى لا يؤدي تحديث الصفحة أو انقطاع مؤقت للاتصال إلى ضياع التقدم.' },
        { heading: '3. خدمات الطرف الثالث', body: 'قد يستخدم مزودو تسجيل الدخول والخرائط ملفاتهم أو تخزينهم الخاص وفق سياساتهم عند استعمال تلك الخدمات.' },
        { heading: '4. التحليلات', body: 'يجب أن تحترم التحليلات غير الضرورية اختيارات الموافقة، وألا تستقبل عنواناً دقيقاً أو رقم هاتف أو تعليمات توصيل خاصة.' },
        { heading: '5. إدارة التخزين', body: 'يمكنك مسح ملفات الارتباط والتخزين المحلي من إعدادات المتصفح. قد يؤدي ذلك إلى تسجيل الخروج وحذف السلة والتفضيلات المحفوظة محلياً.' },
      ],
    },
    accountDeletion: {
      title: 'سياسة حذف الحساب', lastUpdated: UPDATED.ar,
      sections: [
        { heading: '1. طلب الحذف', body: 'يمكنك طلب حذف الحساب من ملفك. توضح الواجهة أي مهلة أو قيود قبل التأكيد.' },
        { heading: '2. المعلومات الشخصية', body: 'يتم حذف الملف والعناوين المحفوظة والبيانات الشخصية القابلة للحذف أو إخفاء هويتها وفق نظام الحذف.' },
        { heading: '3. الاحتفاظ الإلزامي', body: 'قد يتم الاحتفاظ بالطلبات والتسويات والسجلات المالية غير القابلة للتعديل للالتزامات القانونية والضريبية والمحاسبية ومنع الاحتيال والنزاعات، مع تقليل الروابط الشخصية حيثما أمكن.' },
        { heading: '4. حسابات المطاعم', body: 'قد يحتاج الحساب المسؤول عن مطعم نشط إلى نقل الملكية أو الإغلاق أو مراجعة الدعم قبل الحذف.' },
        { heading: '5. تصدير البيانات', body: 'اطلب نسخة من بياناتك الشخصية قبل الحذف إذا أردت الاحتفاظ بها.' },
      ],
    },
  },
};
