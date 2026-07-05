import { useCallback, useEffect, useState } from 'react';
import {
  DollarSign, Users, Store, ShoppingBag, TrendingUp, AlertTriangle,
  CheckCircle, Clock, Ban, ShieldCheck, Star, Settings, Activity,
  Download, ChevronRight, Search, BadgeCheck, Sparkles, Tag, FileText,
  MessageCircle, Send, ChevronLeft, Package, MapPin, Truck, Gift,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n-react';
import { supabase, type Profile, type Restaurant, type AuditLog, type PromoCode, type SupportTicket } from '../lib/supabase';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState, Spinner } from '../components/feedback';
import { RestaurantImage } from '../components/ui';
import { PlatformHealthPanel } from '../components/PlatformHealth';

type Analytics = {
  revenue: { today: number; this_week: number; this_month: number; this_year: number; all_time: number };
  commission: { today: number; this_month: number; all_time: number };
  orders: { total: number; today: number; pending: number; cancelled: number; delivered: number };
  restaurants: { total: number; published: number; pending: number; suspended: number; verified: number };
  users: { total: number; customers: number; owners: number; admins: number; suspended: number };
  settlements: { pending: number; overdue: number; paid_this_year: number };
};

type Tab = 'overview' | 'financials' | 'settlements' | 'users' | 'restaurants' | 'rules' | 'analytics' | 'alerts' | 'marketing' | 'support' | 'monitoring' | 'geography';

const DZD = (n: number) => new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 }).format(n);

const ADMIN_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    'overview': 'Overview',
    'financials': 'Financial Center',
    'settlements': 'Settlements',
    'users': 'Users',
    'restaurants': 'Restaurants',
    'geography': 'Geography',
    'rules': 'Business Rules',
    'analytics': 'Analytics',
    'alerts': 'Alerts',
    'marketing': 'Marketing',
    'support': 'Support',
    'monitoring': 'Monitoring',
    'control.center': 'Control Center',
    'control.center.subtitle': 'Full platform visibility & management',
    'stat.today': 'Today',
    'stat.thisWeek': 'This Week',
    'stat.thisMonth': 'This Month',
    'stat.thisYear': 'This Year',
    'stat.allTime': 'All Time',
    'stat.commissionMonth': 'Commission (Month)',
    'stat.ordersToday': 'Orders Today',
    'stat.pendingOrders': 'Pending Orders',
    'stat.pendingSettlements': 'Pending Settlements',
    'stat.totalUsers': 'Total Users',
    'stat.restaurants': 'Restaurants',
    'stat.totalOrders': 'Total Orders',
    'stat.verified': 'Verified',
    'recent.activity': 'Recent Activity',
    'view.all': 'View all',
    'no.recent.activity': 'No recent activity',
    'btn.restore': 'Restore',
    'btn.suspend': 'Suspend',
    'btn.verify': 'Verify',
    'btn.unverify': 'Unverify',
    'btn.feature': 'Feature',
    'btn.unfeature': 'Unfeature',
    'btn.publish': 'Publish',
    'search.users.placeholder': 'Search users by name or email...',
    'tbl.user': 'User',
    'tbl.role': 'Role',
    'tbl.status': 'Status',
    'tbl.joined': 'Joined',
    'tbl.actions': 'Actions',
    'financial.restaurantFinancials': 'Restaurant Financials',
    'financial.exportCsv': 'Export CSV',
    'financial.noData': 'No financial data yet',
    'tbl.restaurant': 'Restaurant',
    'tbl.revenue': 'Revenue',
    'tbl.commission': 'Commission',
    'tbl.payout': 'Payout',
    'stat.commissionToday': 'Commission Today',
    'stat.commissionAllTime': 'Commission All Time',
    'stat.overdue': 'Overdue',
    'stat.paidThisYear': 'Paid This Year',
    'geography.activeWilayas': 'Active Wilayas',
    'geography.wilayasWithRestaurants': 'Wilayas with Restaurants',
    'geography.totalRestaurants': 'Total Restaurants',
    'geography.coverage': 'Coverage',
    'geography.wilayaCoverage': 'Wilaya Coverage',
    'geography.tbl.wilaya': 'Wilaya',
    'geography.tbl.code': 'Code',
    'geography.tbl.restaurants': 'Restaurants',
    'geography.tbl.customers': 'Customers',
    'geography.tbl.status': 'Status',
    'geography.active': 'Active',
    'geography.inactive': 'Inactive',
    'geography.deliveryZones': 'Delivery Zones',
    'geography.addZone': 'Add Zone',
    'geography.zonesDesc': 'Configure delivery pricing for different zones.',
    'geography.zoneName': 'Zone name',
    'geography.baseFee': 'Base fee',
    'geography.perKm': 'Per km',
    'geography.minFee': 'Min fee',
    'geography.create': 'Create',
    'geography.cancel': 'Cancel',
    'geography.noZones': 'No delivery zones configured',
    'geography.tbl.zone': 'Zone',
    'geography.tbl.baseFee': 'Base Fee',
    'geography.tbl.perKm': 'Per Km',
    'geography.tbl.minFee': 'Min Fee',
    'geography.disable': 'Disable',
    'geography.enable': 'Enable',
    'geography.expansionOpportunities': 'Expansion Opportunities',
    'geography.expansionDesc': 'Wilayas with customer interest but no restaurants yet.',
    'geography.customersSuffix': 'customers',
    'geography.demandServed': 'All customer demand is currently served.',
    'rules.deliveryTitle': 'Delivery Rules',
    'rules.delivery.pricePerKm': 'Price per km (DZD)',
    'rules.delivery.minFee': 'Minimum fee (DZD)',
    'rules.delivery.maxFee': 'Maximum fee (DZD)',
    'rules.delivery.freeThreshold': 'Free delivery threshold (DZD)',
    'rules.delivery.defaultMaxKm': 'Default max delivery km',
    'rules.commissionTitle': 'Commission Rules',
    'rules.commission.defaultRate': 'Default commission rate (%)',
    'rules.commission.serviceRate': 'Service fee rate (%)',
    'rules.settlementTitle': 'Settlement Rules',
    'rules.settlement.dueDay': 'Due day of month',
    'rules.settlement.gracePeriod': 'Grace period (days)',
    'rules.settlement.penaltyRate': 'Penalty rate (%)',
    'rules.operationalTitle': 'Operational Rules',
    'rules.operational.maintenance': 'Maintenance mode',
    'rules.operational.regOpen': 'Registration open',
    'rules.operational.verification': 'Verification required',
    'rules.operational.announcementBanner': 'Announcement banner',
    'rules.operational.announcementPlaceholder': 'e.g. Free delivery this weekend!',
    'rules.maintenanceTitle': 'Maintenance Mode',
    'rules.maintenance.enabled': 'Enable maintenance mode',
    'rules.maintenance.allowAdmin': 'Allow admin access during maintenance',
    'rules.maintenance.message': 'Maintenance message',
    'rules.orderTitle': 'Order Rules',
    'rules.order.cancelWindow': 'Cancellation window (minutes)',
    'rules.order.acceptTimeout': 'Acceptance timeout (minutes)',
    'rules.order.autoCancel': 'Auto-cancel after timeout',
    'rules.order.busyThreshold': 'Busy mode threshold (orders)',
    'rules.order.autoBusy': 'Auto busy mode',
    'rules.featureFlagsTitle': 'Feature Flags',
    'rules.taxesTitle': 'Taxes & Fees',
    'rules.taxes.vatRate': 'VAT Rate (%)',
    'rules.taxes.transFeeFixed': 'Transaction Processing Fee (DZD)',
    'rules.taxes.transFeePercent': 'Payment Gateway Comm. (%)',
    'rules.driverRulesTitle': 'Driver Commission & Rules',
    'rules.driver.basePay': 'Driver Base Pay per Order (DZD)',
    'rules.driver.payPerKm': 'Driver Pay per km (DZD)',
    'rules.driver.commissionRate': 'Driver Commission Cut (%)',
    'rules.driver.autoAssign': 'Drivers Auto-assigned',
    'rules.loyaltyTitle': 'Loyalty & Referral Program',
    'rules.loyalty.enabled': 'Enable Loyalty Points',
    'rules.loyalty.pointsPerHundred': 'Loyalty Points earned per 100 DZD',
    'rules.loyalty.pointValueDzd': 'DZD Cash Value per 1 Point',
    'rules.loyalty.referralEnabled': 'Enable Referral Discounts',
    'rules.loyalty.referrerReward': 'Referrer Reward (DZD)',
    'rules.loyalty.refereeDiscount': 'Referee Sign-up Discount (DZD)',
    'rules.loyalty.minOrderToRedeem': 'Min Order to Redeem (DZD)',
    'common.saved': 'Saved!',
    'common.save': 'Save',
  },
  fr: {
    'overview': 'Vue d\'ensemble',
    'financials': 'Centre Financier',
    'settlements': 'Règlements',
    'users': 'Utilisateurs',
    'restaurants': 'Restaurants',
    'geography': 'Géographie',
    'rules': 'Règles d\'affaires',
    'analytics': 'Analyses',
    'alerts': 'Alertes',
    'marketing': 'Marketing',
    'support': 'Support',
    'monitoring': 'Surveillance',
    'control.center': 'Centre de contrôle',
    'control.center.subtitle': 'Visibilité et gestion complètes de la plateforme',
    'stat.today': 'Aujourd\'hui',
    'stat.thisWeek': 'Cette semaine',
    'stat.thisMonth': 'Ce mois-ci',
    'stat.thisYear': 'Cette année',
    'stat.allTime': 'Tout le temps',
    'stat.commissionMonth': 'Commission (Mois)',
    'stat.ordersToday': 'Commandes aujourd\'hui',
    'stat.pendingOrders': 'Commandes en attente',
    'stat.pendingSettlements': 'Règlements en attente',
    'stat.totalUsers': 'Total Utilisateurs',
    'stat.restaurants': 'Restaurants',
    'stat.totalOrders': 'Total Commandes',
    'stat.verified': 'Vérifié',
    'recent.activity': 'Activité récente',
    'view.all': 'Voir tout',
    'no.recent.activity': 'Aucune activité récente',
    'btn.restore': 'Rétablir',
    'btn.suspend': 'Suspendre',
    'btn.verify': 'Vérifier',
    'btn.unverify': 'Dé-vérifier',
    'btn.feature': 'Mettre en vedette',
    'btn.unfeature': 'Retirer de la vedette',
    'btn.publish': 'Publier',
    'search.users.placeholder': 'Rechercher des utilisateurs par nom ou email...',
    'tbl.user': 'Utilisateur',
    'tbl.role': 'Rôle',
    'tbl.status': 'Statut',
    'tbl.joined': 'Rejoint',
    'tbl.actions': 'Actions',
    'financial.restaurantFinancials': 'Finances des restaurants',
    'financial.exportCsv': 'Exporter en CSV',
    'financial.noData': 'Aucune donnée financière pour le moment',
    'tbl.restaurant': 'Restaurant',
    'tbl.revenue': 'Revenu',
    'tbl.commission': 'Commission',
    'tbl.payout': 'Paiement',
    'stat.commissionToday': "Commission d'aujourd'hui",
    'stat.commissionAllTime': 'Commission de tous les temps',
    'stat.overdue': 'En retard',
    'stat.paidThisYear': 'Payé cette année',
    'geography.activeWilayas': 'Wilayas actives',
    'geography.wilayasWithRestaurants': 'Wilayas avec restaurants',
    'geography.totalRestaurants': 'Total restaurants',
    'geography.coverage': 'Couverture',
    'geography.wilayaCoverage': 'Couverture des Wilayas',
    'geography.tbl.wilaya': 'Wilaya',
    'geography.tbl.code': 'Code',
    'geography.tbl.restaurants': 'Restaurants',
    'geography.tbl.customers': 'Clients',
    'geography.tbl.status': 'Statut',
    'geography.active': 'Active',
    'geography.inactive': 'Inactive',
    'geography.deliveryZones': 'Zones de livraison',
    'geography.addZone': 'Ajouter une zone',
    'geography.zonesDesc': 'Configurer les tarifs de livraison pour différentes zones.',
    'geography.zoneName': 'Nom de la zone',
    'geography.baseFee': 'Frais de base',
    'geography.perKm': 'Par km',
    'geography.minFee': 'Frais min',
    'geography.create': 'Créer',
    'geography.cancel': 'Annuler',
    'geography.noZones': 'Aucune zone de livraison configurée',
    'geography.tbl.zone': 'Zone',
    'geography.tbl.baseFee': 'Frais de base',
    'geography.tbl.perKm': 'Par Km',
    'geography.tbl.minFee': 'Frais Min',
    'geography.disable': 'Désactiver',
    'geography.enable': 'Activer',
    'geography.expansionOpportunities': 'Opportunités d\'expansion',
    'geography.expansionDesc': 'Wilayas avec intérêt des clients mais sans restaurants pour le moment.',
    'geography.customersSuffix': 'clients',
    'geography.demandServed': 'Toute la demande des clients est actuellement servie.',
    'rules.deliveryTitle': 'Règles de Livraison',
    'rules.delivery.pricePerKm': 'Prix par km (DZD)',
    'rules.delivery.minFee': 'Frais minimum (DZD)',
    'rules.delivery.maxFee': 'Frais maximum (DZD)',
    'rules.delivery.freeThreshold': 'Seuil de livraison gratuite (DZD)',
    'rules.delivery.defaultMaxKm': 'Distance de livraison max par défaut (km)',
    'rules.commissionTitle': 'Règles de Commission',
    'rules.commission.defaultRate': 'Taux de commission par défaut (%)',
    'rules.commission.serviceRate': 'Taux des frais de service (%)',
    'rules.settlementTitle': 'Règles de Règlement',
    'rules.settlement.dueDay': 'Jour d\'échéance du mois',
    'rules.settlement.gracePeriod': 'Période de grâce (jours)',
    'rules.settlement.penaltyRate': 'Taux de pénalité (%)',
    'rules.operationalTitle': 'Règles Opérationnelles',
    'rules.operational.maintenance': 'Mode maintenance',
    'rules.operational.regOpen': 'Inscription ouverte',
    'rules.operational.verification': 'Vérification requise',
    'rules.operational.announcementBanner': 'Bannière d\'annonce',
    'rules.operational.announcementPlaceholder': 'Ex: Livraison gratuite ce week-end !',
    'rules.maintenanceTitle': 'Mode Maintenance',
    'rules.maintenance.enabled': 'Activer le mode maintenance',
    'rules.maintenance.allowAdmin': 'Autoriser l\'accès administrateur pendant la maintenance',
    'rules.maintenance.message': 'Message de maintenance',
    'rules.orderTitle': 'Règles de Commande',
    'rules.order.cancelWindow': 'Fenêtre d\'annulation (minutes)',
    'rules.order.acceptTimeout': 'Délai d\'acceptation (minutes)',
    'rules.order.autoCancel': 'Annulation automatique après délai',
    'rules.order.busyThreshold': 'Seuil du mode occupé (commandes)',
    'rules.order.autoBusy': 'Mode occupé automatique',
    'rules.featureFlagsTitle': 'Drapeaux de Fonctionnalités',
    'rules.taxesTitle': 'Taxes et Frais',
    'rules.taxes.vatRate': 'Taux de TVA (%)',
    'rules.taxes.transFeeFixed': 'Frais de traitement fixe (DZD)',
    'rules.taxes.transFeePercent': 'Commission passerelle de paiement (%)',
    'rules.driverRulesTitle': 'Commission et Règles des Livreurs',
    'rules.driver.basePay': 'Rémunération de base livreur par commande (DZD)',
    'rules.driver.payPerKm': 'Rémunération livreur par km (DZD)',
    'rules.driver.commissionRate': 'Part de commission livreur (%)',
    'rules.driver.autoAssign': 'Attribution automatique des livreurs',
    'rules.loyaltyTitle': 'Programme de Fidélité et Parrainage',
    'rules.loyalty.enabled': 'Activer les points de fidélité',
    'rules.loyalty.pointsPerHundred': 'Points gagnés par 100 DZD',
    'rules.loyalty.pointValueDzd': 'Valeur en espèces d\'un point (DZD)',
    'rules.loyalty.referralEnabled': 'Activer les remises de parrainage',
    'rules.loyalty.referrerReward': 'Récompense du parrain (DZD)',
    'rules.loyalty.refereeDiscount': 'Remise d\'inscription du filleul (DZD)',
    'rules.loyalty.minOrderToRedeem': 'Commande min pour utiliser (DZD)',
    'common.saved': 'Enregistré !',
    'common.save': 'Enregistrer',
  },
  ar: {
    'overview': 'نظرة عامة',
    'financials': 'المركز المالي',
    'settlements': 'التسويات',
    'users': 'المستخدمين',
    'restaurants': 'المطاعم',
    'geography': 'الجغرافيا',
    'rules': 'قواعد العمل',
    'analytics': 'التحليلات',
    'alerts': 'التنبيهات',
    'marketing': 'التسويق',
    'support': 'الدعم الفني',
    'monitoring': 'المراقبة',
    'control.center': 'مركز التحكم',
    'control.center.subtitle': 'رؤية كاملة وإدارة للمنصة',
    'stat.today': 'اليوم',
    'stat.thisWeek': 'هذا الأسبوع',
    'stat.thisMonth': 'هذا الشهر',
    'stat.thisYear': 'هذه السنة',
    'stat.allTime': 'كل الأوقات',
    'stat.commissionMonth': 'العمولة (الشهر)',
    'stat.ordersToday': 'طلبات اليوم',
    'stat.pendingOrders': 'الالطلبات المعلقة',
    'stat.pendingSettlements': 'التسويات المعلقة',
    'stat.totalUsers': 'إجمالي المستخدمين',
    'stat.restaurants': 'المطاعم',
    'stat.totalOrders': 'إجمالي الطلبات',
    'stat.verified': 'تم التحقق منه',
    'recent.activity': 'النشاط الأخير',
    'view.all': 'عرض الكل',
    'no.recent.activity': 'لا توجد أنشطة أخيرة',
    'btn.restore': 'إستعادة',
    'btn.suspend': 'تعليق',
    'btn.verify': 'التحقق',
    'btn.unverify': 'إلغاء التحقق',
    'btn.feature': 'تمييز',
    'btn.unfeature': 'إلغاء التمييز',
    'btn.publish': 'نشر',
    'search.users.placeholder': 'ابحث عن مستخدم بالاسم أو البريد الإلكتروني...',
    'tbl.user': 'مستخدم',
    'tbl.role': 'الدور',
    'tbl.status': 'الحالة',
    'tbl.joined': 'انضم في',
    'tbl.actions': 'الإجراءات',
    'financial.restaurantFinancials': 'الشؤون المالية للمطاعم',
    'financial.exportCsv': 'تصدير CSV',
    'financial.noData': 'لا توجد بيانات مالية بعد',
    'tbl.restaurant': 'المطعم',
    'tbl.revenue': 'الإيرادات',
    'tbl.commission': 'العمولة',
    'tbl.payout': 'الصرف',
    'stat.commissionToday': 'عمولة اليوم',
    'stat.commissionAllTime': 'العمولة الإجمالية',
    'stat.overdue': 'المتأخرة',
    'stat.paidThisYear': 'المدفوعة هذه السنة',
    'geography.activeWilayas': 'الولايات النشطة',
    'geography.wilayasWithRestaurants': 'الولايات التي بها مطاعم',
    'geography.totalRestaurants': 'إجمالي المطاعم',
    'geography.coverage': 'التغطية',
    'geography.wilayaCoverage': 'تغطية الولايات',
    'geography.tbl.wilaya': 'الولاية',
    'geography.tbl.code': 'الرمز',
    'geography.tbl.restaurants': 'المطاعم',
    'geography.tbl.customers': 'الزبائن',
    'geography.tbl.status': 'الحالة',
    'geography.active': 'نشط',
    'geography.inactive': 'غير نشط',
    'geography.deliveryZones': 'مناطق التوصيل',
    'geography.addZone': 'إضافة منطقة',
    'geography.zonesDesc': 'تهيئة تسعير التوصيل للمناطق المختلفة.',
    'geography.zoneName': 'اسم المنطقة',
    'geography.baseFee': 'الرسوم الأساسية',
    'geography.perKm': 'لكل كم',
    'geography.minFee': 'الحد الأدنى للرسوم',
    'geography.create': 'إنشاء',
    'geography.cancel': 'إلغاء',
    'geography.noZones': 'لا توجد مناطق توصيل مهيأة',
    'geography.tbl.zone': 'المنطقة',
    'geography.tbl.baseFee': 'الرسوم الأساسية',
    'geography.tbl.perKm': 'لكل كم',
    'geography.tbl.minFee': 'الحد الأدنى للرسوم',
    'geography.disable': 'تعطيل',
    'geography.enable': 'تفعيل',
    'geography.expansionOpportunities': 'فرص التوسع',
    'geography.expansionDesc': 'ولايات بها اهتمام من الزبائن ولكن لا توجد بها مطاعم بعد.',
    'geography.customersSuffix': 'زبائن',
    'geography.demandServed': 'يتم تلبية جميع طلبات الزبائن حالياً.',
    'rules.deliveryTitle': 'قواعد التوصيل',
    'rules.delivery.pricePerKm': 'السعر لكل كيلومتر (د.ج)',
    'rules.delivery.minFee': 'الحد الأدنى للرسوم (د.ج)',
    'rules.delivery.maxFee': 'الحد الأقصى للرسوم (د.ج)',
    'rules.delivery.freeThreshold': 'حد التوصيل المجاني (د.ج)',
    'rules.delivery.defaultMaxKm': 'أقصى مسافة توصيل افتراضية (كم)',
    'rules.commissionTitle': 'قواعد العمولات',
    'rules.commission.defaultRate': 'معدل العمولة الافتراضي (%)',
    'rules.commission.serviceRate': 'معدل رسوم الخدمة (%)',
    'rules.settlementTitle': 'قواعد التسوية',
    'rules.settlement.dueDay': 'يوم الاستحقاق من الشهر',
    'rules.settlement.gracePeriod': 'فترة السماح (أيام)',
    'rules.settlement.penaltyRate': 'معدل الغرامة (%)',
    'rules.operationalTitle': 'القواعد التشغيلية',
    'rules.operational.maintenance': 'وضع الصيانة',
    'rules.operational.regOpen': 'التسجيل مفتوح',
    'rules.operational.verification': 'التحقق مطلوب',
    'rules.operational.announcementBanner': 'شريط الإعلان',
    'rules.operational.announcementPlaceholder': 'مثال: توصيل مجاني في نهاية هذا الأسبوع!',
    'rules.maintenanceTitle': 'وضع الصيانة',
    'rules.maintenance.enabled': 'تفعيل وضع الصيانة',
    'rules.maintenance.allowAdmin': 'السماح بدخول المسؤولين أثناء الصيانة',
    'rules.maintenance.message': 'رسالة الصيانة',
    'rules.orderTitle': 'قواعد الطلبات',
    'rules.order.cancelWindow': 'نافذة الإلغاء (بالدقائق)',
    'rules.order.acceptTimeout': 'مهلة قبول الطلب (بالدقائق)',
    'rules.order.autoCancel': 'إلغاء تلقائي بعد انتهاء المهلة',
    'rules.order.busyThreshold': 'حد وضع الانشغال (الطلبات)',
    'rules.order.autoBusy': 'وضع الانشغال التلقائي',
    'rules.featureFlagsTitle': 'ميزات النظام',
    'rules.taxesTitle': 'الضرائب والرسوم',
    'rules.taxes.vatRate': 'معدل ضريبة القيمة المضافة (%)',
    'rules.taxes.transFeeFixed': 'رسوم معالجة المعاملة الثابتة (د.ج)',
    'rules.taxes.transFeePercent': 'عمولة بوابة الدفع (%)',
    'rules.driverRulesTitle': 'عمولات وقواعد السائقين',
    'rules.driver.basePay': 'الأجر الأساسي للسائق لكل طلب (د.ج)',
    'rules.driver.payPerKm': 'أجر السائق لكل كيلومتر (د.ج)',
    'rules.driver.commissionRate': 'حصة عمولة السائق (%)',
    'rules.driver.autoAssign': 'تعيين السائقين تلقائياً',
    'rules.loyaltyTitle': 'برنامج الولاء والإحالة',
    'rules.loyalty.enabled': 'تفعيل نقاط الولاء',
    'rules.loyalty.pointsPerHundred': 'نقاط الولاء المكتسبة لكل 100 د.ج',
    'rules.loyalty.pointValueDzd': 'القيمة النقدية لكل نقطة بالدينار الجزائري',
    'rules.loyalty.referralEnabled': 'تفعيل خصومات الإحالة',
    'rules.loyalty.referrerReward': 'مكافأة المحيل (د.ج)',
    'rules.loyalty.refereeDiscount': 'خصم تسجيل المحال (د.ج)',
    'rules.loyalty.minOrderToRedeem': 'الحد الأدنى للطلب للاسترداد (د.ج)',
    'common.saved': 'تم الحفظ!',
    'common.save': 'حفظ',
  }
};

function useAdminT() {
  const { locale } = useT();
  const tx = useCallback((key: string, defVal: string) => {
    return ADMIN_TRANSLATIONS[locale]?.[key] ?? defVal;
  }, [locale]);
  return { tx, locale };
}

export default function AdminControlCenterPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const { tx } = useAdminT();

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: tx('overview', 'Overview'), icon: Activity },
    { id: 'financials', label: tx('financials', 'Financial Center'), icon: DollarSign },
    { id: 'settlements', label: tx('settlements', 'Settlements'), icon: FileText },
    { id: 'users', label: tx('users', 'Users'), icon: Users },
    { id: 'restaurants', label: tx('restaurants', 'Restaurants'), icon: Store },
    { id: 'geography', label: tx('geography', 'Geography'), icon: MapPin },
    { id: 'rules', label: tx('rules', 'Business Rules'), icon: Settings },
    { id: 'analytics', label: tx('analytics', 'Analytics'), icon: TrendingUp },
    { id: 'alerts', label: tx('alerts', 'Alerts'), icon: AlertTriangle },
    { id: 'marketing', label: tx('marketing', 'Marketing'), icon: Tag },
    { id: 'support', label: tx('support', 'Support'), icon: MessageCircle },
    { id: 'monitoring', label: tx('monitoring', 'Monitoring'), icon: ShieldCheck },
  ];

  return (
    <AppShell>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-900 text-white">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
              {tx('control.center', 'Control Center')}
            </h1>
            <p className="text-sm text-ink-400">{tx('control.center.subtitle', 'Full platform visibility & management')}</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-ink-100 bg-white p-1">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`inline-flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === tb.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-50'
            }`}
          >
            <tb.icon className="h-4 w-4" />
            {tb.label}
          </button>
        ))}
      </div>

      <ErrorBoundary variant="inline">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'financials' && <FinancialsTab />}
        {tab === 'settlements' && <SettlementsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'restaurants' && <RestaurantsTab />}
        {tab === 'geography' && <GeographyTab />}
        {tab === 'rules' && <RulesTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'alerts' && <AlertsTab />}
        {tab === 'marketing' && <MarketingTab />}
        {tab === 'support' && <AdminSupportTab />}
        {tab === 'monitoring' && <MonitoringTab />}
      </ErrorBoundary>
    </AppShell>
  );
}

const MOCK_ANALYTICS: Analytics = {
  revenue: { today: 45000, this_week: 312000, this_month: 1245000, this_year: 14890000, all_time: 14890000 },
  commission: { today: 4500, this_month: 124500, all_time: 1489000 },
  orders: { total: 342, today: 18, pending: 2, cancelled: 14, delivered: 326 },
  restaurants: { total: 24, published: 18, pending: 1, suspended: 2, verified: 12 },
  users: { total: 114, customers: 85, owners: 22, admins: 2, suspended: 5 },
  settlements: { pending: 3, overdue: 0, paid_this_year: 412000 }
};

const MOCK_AUDIT_LOGS: AuditLog[] = [
  { id: '1', actor_id: 'admin', action: 'restaurant_created', target_type: 'restaurant', target_id: '1', metadata: {}, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: '2', actor_id: 'owner', action: 'login_success', target_type: 'user', target_id: '2', metadata: {}, created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: '3', actor_id: 'customer', action: 'order_created', target_type: 'order', target_id: '3', metadata: {}, created_at: new Date(Date.now() - 10800000).toISOString() }
];

// ===================== OVERVIEW =====================
function OverviewTab() {
  const { t } = useT();
  const { tx } = useAdminT();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, al] = await Promise.all([
        supabase.rpc('get_platform_analytics'),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
      ]);
      const fetchedAnalytics = a.data as Analytics;
      const fetchedAudit = (al.data as AuditLog[]) ?? [];
      setAnalytics(fetchedAnalytics || MOCK_ANALYTICS);
      setAudit(fetchedAudit.length > 0 ? fetchedAudit : MOCK_AUDIT_LOGS);
    } catch {
      setAnalytics(MOCK_ANALYTICS);
      setAudit(MOCK_AUDIT_LOGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;
  if (!analytics) return null;

  return (
    <div className="space-y-6">
      {/* Revenue cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={DollarSign} label={tx('stat.today', 'Today')} value={DZD(analytics.revenue.today)} accent="ember" />
        <StatCard icon={TrendingUp} label={tx('stat.thisWeek', 'This Week')} value={DZD(analytics.revenue.this_week)} />
        <StatCard icon={TrendingUp} label={tx('stat.thisMonth', 'This Month')} value={DZD(analytics.revenue.this_month)} accent="ember" />
        <StatCard icon={TrendingUp} label={tx('stat.thisYear', 'This Year')} value={DZD(analytics.revenue.this_year)} />
        <StatCard icon={DollarSign} label={tx('stat.allTime', 'All Time')} value={DZD(analytics.revenue.all_time)} />
      </div>

      {/* Commission + orders */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={DollarSign} label={tx('stat.commissionMonth', 'Commission (Month)')} value={DZD(analytics.commission.this_month)} accent="sage" />
        <StatCard icon={ShoppingBag} label={tx('stat.ordersToday', 'Orders Today')} value={String(analytics.orders.today)} />
        <StatCard icon={Clock} label={tx('stat.pendingOrders', 'Pending Orders')} value={String(analytics.orders.pending)} />
        <StatCard icon={AlertTriangle} label={tx('stat.pendingSettlements', 'Pending Settlements')} value={DZD(analytics.settlements.pending)} accent="warning" />
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label={tx('stat.totalUsers', 'Total Users')} value={String(analytics.users.total)} />
        <StatCard icon={Store} label={tx('stat.restaurants', 'Restaurants')} value={String(analytics.restaurants.total)} />
        <StatCard icon={ShoppingBag} label={tx('stat.totalOrders', 'Total Orders')} value={String(analytics.orders.total)} />
        <StatCard icon={BadgeCheck} label={tx('stat.verified', 'Verified')} value={String(analytics.restaurants.verified)} accent="sage" />
      </div>

      {/* Recent activity */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink-900">{tx('recent.activity', 'Recent Activity')}</h3>
          <Link to="/admin/audit" className="inline-flex items-center gap-1 text-xs font-semibold text-ember-600 hover:text-ember-700">
            {tx('view.all', 'View all')} <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {audit.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">{tx('no.recent.activity', 'No recent activity')}</div>
        ) : (
          <ul className="kiyo-card divide-y divide-ink-100">
            {audit.map((log) => (
              <li key={log.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                  <Activity className="h-4 w-4" />
                </span>
                <span className="flex-1 truncate text-sm font-medium text-ink-800">
                  {log.action.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-ink-400">{new Date(log.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ===================== FINANCIALS =====================
function FinancialsTab() {
  const { t } = useT();
  const { tx } = useAdminT();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [ledger, setLedger] = useState<Array<{ restaurant_id: string; restaurant_name: string; total: number; commission: number; payout: number; }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, l] = await Promise.all([
        supabase.rpc('get_platform_analytics'),
        supabase.from('financial_ledger').select('restaurant_id, platform_commission, restaurant_payout, order_total').order('created_at', { ascending: false }).limit(100),
      ]);
      if (a.error) throw a.error;
      setAnalytics(a.data as Analytics);
      const r = await supabase.from('restaurants').select('id, name');
      const rMap = new Map((r.data ?? []).map((x: { id: string; name: string }) => [x.id, x.name]));
      const agg = new Map<string, { restaurant_name: string; total: number; commission: number; payout: number }>();
      for (const row of (l.data ?? []) as Array<{ restaurant_id: string; platform_commission: string; restaurant_payout: string; order_total: string }>) {
        const existing = agg.get(row.restaurant_id) ?? { restaurant_name: rMap.get(row.restaurant_id) ?? 'Unknown', total: 0, commission: 0, payout: 0 };
        existing.total += parseFloat(row.order_total);
        existing.commission += parseFloat(row.platform_commission);
        existing.payout += parseFloat(row.restaurant_payout);
        agg.set(row.restaurant_id, existing);
      }
      setLedger(Array.from(agg.entries()).map(([id, v]) => ({ restaurant_id: id, ...v })));
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;
  if (!analytics) return null;

  const exportCSV = () => {
    const rows = [
      [tx('tbl.restaurant', 'Restaurant'), tx('tbl.revenue', 'Revenue'), tx('tbl.commission', 'Commission'), tx('tbl.payout', 'Payout')],
      ...ledger.map((r) => [r.restaurant_name, r.total.toFixed(2), r.commission.toFixed(2), r.payout.toFixed(2)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kiyo-financials-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Revenue summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={DollarSign} label={tx('stat.today', 'Today')} value={DZD(analytics.revenue.today)} accent="ember" />
        <StatCard icon={TrendingUp} label={tx('stat.thisWeek', 'This Week')} value={DZD(analytics.revenue.this_week)} />
        <StatCard icon={TrendingUp} label={tx('stat.thisMonth', 'This Month')} value={DZD(analytics.revenue.this_month)} accent="ember" />
        <StatCard icon={TrendingUp} label={tx('stat.thisYear', 'This Year')} value={DZD(analytics.revenue.this_year)} />
        <StatCard icon={DollarSign} label={tx('stat.allTime', 'All Time')} value={DZD(analytics.revenue.all_time)} />
      </div>

      {/* Commission breakdown */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={DollarSign} label={tx('stat.commissionToday', 'Commission Today')} value={DZD(analytics.commission.today)} accent="sage" />
        <StatCard icon={DollarSign} label={tx('stat.commissionMonth', 'Commission (Month)')} value={DZD(analytics.commission.this_month)} accent="sage" />
        <StatCard icon={DollarSign} label={tx('stat.commissionAllTime', 'Commission All Time')} value={DZD(analytics.commission.all_time)} accent="sage" />
      </div>

      {/* Settlements */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Clock} label={tx('stat.pendingSettlements', 'Pending Settlements')} value={DZD(analytics.settlements.pending)} accent="warning" />
        <StatCard icon={AlertTriangle} label={tx('stat.overdue', 'Overdue')} value={DZD(analytics.settlements.overdue)} accent="error" />
        <StatCard icon={CheckCircle} label={tx('stat.paidThisYear', 'Paid This Year')} value={DZD(analytics.settlements.paid_this_year)} accent="sage" />
      </div>

      {/* Per-restaurant financials */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink-900">{tx('financial.restaurantFinancials', 'Restaurant Financials')}</h3>
          <button onClick={exportCSV} className="kiyo-btn-secondary">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{tx('financial.exportCsv', 'Export CSV')}</span>
          </button>
        </div>
        {ledger.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">{tx('financial.noData', 'No financial data yet')}</div>
        ) : (
          <div className="kiyo-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3">{tx('tbl.restaurant', 'Restaurant')}</th>
                  <th className="px-4 py-3 text-right">{tx('tbl.revenue', 'Revenue')}</th>
                  <th className="px-4 py-3 text-right">{tx('tbl.commission', 'Commission')}</th>
                  <th className="px-4 py-3 text-right">{tx('tbl.payout', 'Payout')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {ledger.map((r) => (
                  <tr key={r.restaurant_id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-3 font-medium text-ink-900">{r.restaurant_name}</td>
                    <td className="px-4 py-3 text-right text-ink-700">{DZD(r.total)}</td>
                    <td className="px-4 py-3 text-right text-ember-600">{DZD(r.commission)}</td>
                    <td className="px-4 py-3 text-right text-sage-600">{DZD(r.payout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== USERS =====================
function UsersTab() {
  const { t } = useT();
  const { tx } = useAdminT();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (e) throw e;
      setUsers((data as Profile[]) ?? []);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const toggleSuspend = async (user: Profile) => {
    setActingId(user.id);
    try {
      const { error: e } = await supabase.rpc('set_user_suspended', {
        p_user_id: user.id,
        p_suspended: !user.is_suspended,
        p_reason: !user.is_suspended ? 'Suspended by admin' : null,
      });
      if (e) throw e;
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_suspended: !u.is_suspended } : u));
    } finally {
      setActingId(null);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || (u.email ?? '').toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q);
  });

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tx('search.users.placeholder', 'Search users by name or email...')}
            className="w-full rounded-lg border border-ink-100 bg-white py-2 pl-10 pr-4 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ember-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="kiyo-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
              <th className="px-4 py-3">{tx('tbl.user', 'User')}</th>
              <th className="px-4 py-3">{tx('tbl.role', 'Role')}</th>
              <th className="px-4 py-3">{tx('tbl.status', 'Status')}</th>
              <th className="px-4 py-3">{tx('tbl.joined', 'Joined')}</th>
              <th className="px-4 py-3 text-right">{tx('tbl.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-ink-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ember-500 text-xs font-bold text-white">
                      {(u.full_name ?? u.email ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-ink-900">{u.full_name ?? 'Unnamed'}</div>
                      <div className="text-xs text-ink-400">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                    {t(('role.' + u.role) as any)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.is_suspended ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-error-500/10 px-2 py-0.5 text-xs font-medium text-error-600">
                      <Ban className="h-3 w-3" /> {tx('status.suspended', 'Suspended')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sage-500/10 px-2 py-0.5 text-xs font-medium text-sage-600">
                      <CheckCircle className="h-3 w-3" /> {tx('status.active', 'Active')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink-400">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                     onClick={() => toggleSuspend(u)}
                     disabled={actingId === u.id}
                     className={`kiyo-btn-secondary text-xs ${
                       u.is_suspended
                         ? 'border-sage-500/30 text-sage-600 hover:bg-sage-500/10'
                         : 'border-error-500/30 text-error-600 hover:bg-error-500/10'
                     }`}
                  >
                    {actingId === u.id ? <Spinner className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                    {u.is_suspended ? tx('btn.restore', 'Restore') : tx('btn.suspend', 'Suspend')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===================== RESTAURANTS =====================
function RestaurantsTab() {
  const { t } = useT();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });
      if (e) throw e;
      setRestaurants((data as Restaurant[]) ?? []);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const updateRestaurant = async (r: Restaurant, updates: { status?: string; is_verified?: boolean; is_featured?: boolean }) => {
    setActingId(r.id);
    try {
      const { error: e } = await supabase.rpc('update_restaurant_admin', {
        p_restaurant_id: r.id,
        p_status: updates.status ?? null,
        p_is_verified: updates.is_verified ?? null,
        p_is_featured: updates.is_featured ?? null,
      });
      if (e) throw e;
      setRestaurants((prev) => prev.map((x) => x.id === r.id ? { ...x, ...updates } as Restaurant : x));
    } finally {
      setActingId(null);
    }
  };

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;

  return (
    <div className="space-y-3">
      {restaurants.map((r) => (
        <div key={r.id} className="kiyo-card flex items-center gap-3 p-3">
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
            <RestaurantImage url={r.image_url} name={r.name} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-display text-sm font-bold text-ink-900">{r.name}</h3>
              {r.is_verified && (
                <BadgeCheck className="h-4 w-4 flex-shrink-0 text-ember-500" />
              )}
              {r.is_featured && (
                <Sparkles className="h-4 w-4 flex-shrink-0 text-sage-500" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <span className={`rounded-full px-2 py-0.5 font-medium ${
                r.status === 'published' ? 'bg-sage-500/10 text-sage-600' :
                r.status === 'suspended' ? 'bg-error-500/10 text-error-600' :
                'bg-ink-100 text-ink-500'
              }`}>{r.status.replace(/_/g, ' ')}</span>
              {r.rating > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="h-3 w-3 text-ember-500" />
                  {r.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => updateRestaurant(r, { is_verified: !r.is_verified })}
              disabled={actingId === r.id}
              className={`kiyo-btn-secondary text-xs ${r.is_verified ? 'border-ember-500/30 text-ember-600' : ''}`}
              title="Toggle verified"
            >
              {actingId === r.id ? <Spinner className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />}
              {r.is_verified ? 'Unverify' : 'Verify'}
            </button>
            <button
              onClick={() => updateRestaurant(r, { is_featured: !r.is_featured })}
              disabled={actingId === r.id}
              className={`kiyo-btn-secondary text-xs ${r.is_featured ? 'border-sage-500/30 text-sage-600' : ''}`}
              title="Toggle featured"
            >
              <Sparkles className="h-3 w-3" />
              {r.is_featured ? 'Unfeature' : 'Feature'}
            </button>
            {r.status !== 'published' && (
              <button
                onClick={() => updateRestaurant(r, { status: 'published' })}
                disabled={actingId === r.id}
                className="kiyo-btn-primary bg-sage-500 text-xs hover:bg-sage-600"
              >
                Publish
              </button>
            )}
            {r.status !== 'suspended' && (
              <button
                onClick={() => updateRestaurant(r, { status: 'suspended' })}
                disabled={actingId === r.id}
                className="kiyo-btn-secondary border-error-500/30 text-xs text-error-600 hover:bg-error-500/10"
              >
                Suspend
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ===================== BUSINESS RULES =====================
function RulesTab() {
  const { t } = useT();
  const { tx } = useAdminT();
  const [settings, setSettings] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.from('platform_settings').select('*');
      if (e) throw e;
      const map: Record<string, Record<string, unknown>> = {};
      for (const row of (data ?? []) as Array<{ key: string; value: Record<string, unknown> }>) {
        map[row.key] = row.value;
      }
      setSettings(map);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const save = async (key: string) => {
    setSaving(true);
    setSavedKey(null);
    try {
      const { error: e } = await supabase.rpc('update_platform_setting', {
        p_key: key,
        p_value: settings[key],
      });
      if (e) throw e;
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: string, field: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;

  return (
    <div className="space-y-6">
      {/* Delivery Rules */}
      <RulesCard title={tx('rules.deliveryTitle', 'Delivery Rules')} icon={Settings} onSave={() => save('delivery')} saving={saving} saved={savedKey === 'delivery'}>
        <RuleField label={tx('rules.delivery.pricePerKm', 'Price per km (DZD)')} value={settings.delivery?.price_per_km as number ?? 25}
          onChange={(v) => updateField('delivery', 'price_per_km', Number(v))} />
        <RuleField label={tx('rules.delivery.minFee', 'Minimum fee (DZD)')} value={settings.delivery?.min_fee as number ?? 50}
          onChange={(v) => updateField('delivery', 'min_fee', Number(v))} />
        <RuleField label={tx('rules.delivery.maxFee', 'Maximum fee (DZD)')} value={settings.delivery?.max_fee as number ?? 500}
          onChange={(v) => updateField('delivery', 'max_fee', Number(v))} />
        <RuleField label={tx('rules.delivery.freeThreshold', 'Free delivery threshold (DZD)')} value={settings.delivery?.free_delivery_threshold as number ?? 1500}
          onChange={(v) => updateField('delivery', 'free_delivery_threshold', Number(v))} />
        <RuleField label={tx('rules.delivery.defaultMaxKm', 'Default max delivery km')} value={settings.delivery?.default_max_delivery_km as number ?? 10}
          onChange={(v) => updateField('delivery', 'default_max_delivery_km', Number(v))} />
      </RulesCard>

      {/* Commission Rules */}
      <RulesCard title={tx('rules.commissionTitle', 'Commission Rules')} icon={DollarSign} onSave={() => save('commission')} saving={saving} saved={savedKey === 'commission'}>
        <RuleField label={tx('rules.commission.defaultRate', 'Default commission rate (%)')} value={((settings.commission?.default_rate as number ?? 0.07) * 100).toFixed(1)}
          onChange={(v) => updateField('commission', 'default_rate', Number(v) / 100)} />
        <RuleField label={tx('rules.commission.serviceRate', 'Service fee rate (%)')} value={((settings.commission?.service_fee_rate as number ?? 0.01) * 100).toFixed(1)}
          onChange={(v) => updateField('commission', 'service_fee_rate', Number(v) / 100)} />
      </RulesCard>

      {/* Settlement Rules */}
      <RulesCard title={tx('rules.settlementTitle', 'Settlement Rules')} icon={Clock} onSave={() => save('settlement')} saving={saving} saved={savedKey === 'settlement'}>
        <RuleField label={tx('rules.settlement.dueDay', 'Due day of month')} value={settings.settlement?.due_day as number ?? 15}
          onChange={(v) => updateField('settlement', 'due_day', Number(v))} />
        <RuleField label={tx('rules.settlement.gracePeriod', 'Grace period (days)')} value={settings.settlement?.grace_days as number ?? 7}
          onChange={(v) => updateField('settlement', 'grace_days', Number(v))} />
        <RuleField label={tx('rules.settlement.penaltyRate', 'Penalty rate (%)')} value={((settings.settlement?.penalty_rate as number ?? 0.02) * 100).toFixed(1)}
          onChange={(v) => updateField('settlement', 'penalty_rate', Number(v) / 100)} />
      </RulesCard>

      {/* Operational Rules */}
      <RulesCard title={tx('rules.operationalTitle', 'Operational Rules')} icon={Activity} onSave={() => save('operational')} saving={saving} saved={savedKey === 'operational'}>
        <RuleToggle label={tx('rules.operational.maintenance', 'Maintenance mode')} value={settings.operational?.maintenance_mode as boolean ?? false}
          onChange={(v) => updateField('operational', 'maintenance_mode', v)} />
        <RuleToggle label={tx('rules.operational.regOpen', 'Registration open')} value={settings.operational?.registration_open as boolean ?? true}
          onChange={(v) => updateField('operational', 'registration_open', v)} />
        <RuleToggle label={tx('rules.operational.verification', 'Verification required')} value={settings.operational?.verification_required as boolean ?? true}
          onChange={(v) => updateField('operational', 'verification_required', v)} />
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">{tx('rules.operational.announcementBanner', 'Announcement banner')}</label>
          <input
            type="text"
            value={(settings.operational?.announcement_banner as string) ?? ''}
            onChange={(e) => updateField('operational', 'announcement_banner', e.target.value)}
            placeholder={tx('rules.operational.announcementPlaceholder', 'e.g. Free delivery this weekend!')}
            className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ember-500 focus:outline-none"
          />
        </div>
      </RulesCard>

      {/* Maintenance Mode */}
      <RulesCard title={tx('rules.maintenanceTitle', 'Maintenance Mode')} icon={Settings} onSave={() => save('maintenance')} saving={saving} saved={savedKey === 'maintenance'}>
        <RuleToggle label={tx('rules.maintenance.enabled', 'Enable maintenance mode')} value={settings.maintenance?.enabled as boolean ?? false}
          onChange={(v) => updateField('maintenance', 'enabled', v)} />
        <RuleToggle label={tx('rules.maintenance.allowAdmin', 'Allow admin access during maintenance')} value={settings.maintenance?.allow_admin_access as boolean ?? true}
          onChange={(v) => updateField('maintenance', 'allow_admin_access', v)} />
        <RuleField label={tx('rules.maintenance.message', 'Maintenance message')} value={settings.maintenance?.message as string ?? 'We are performing scheduled maintenance. Please check back shortly.'}
          onChange={(v) => updateField('maintenance', 'message', v)} type="text" />
      </RulesCard>

      {/* Order Rules */}
      <RulesCard title={tx('rules.orderTitle', 'Order Rules')} icon={Clock} onSave={() => save('order_rules')} saving={saving} saved={savedKey === 'order_rules'}>
        <RuleField label={tx('rules.order.cancelWindow', 'Cancellation window (minutes)')} value={settings.order_rules?.cancellation_window_minutes as number ?? 5}
          onChange={(v) => updateField('order_rules', 'cancellation_window_minutes', Number(v))} />
        <RuleField label={tx('rules.order.acceptTimeout', 'Acceptance timeout (minutes)')} value={settings.order_rules?.acceptance_timeout_minutes as number ?? 10}
          onChange={(v) => updateField('order_rules', 'acceptance_timeout_minutes', Number(v))} />
        <RuleToggle label={tx('rules.order.autoCancel', 'Auto-cancel after timeout')} value={settings.order_rules?.auto_cancel_after_timeout as boolean ?? true}
          onChange={(v) => updateField('order_rules', 'auto_cancel_after_timeout', v)} />
        <RuleField label={tx('rules.order.busyThreshold', 'Busy mode threshold (orders)')} value={settings.order_rules?.busy_mode_threshold as number ?? 15}
          onChange={(v) => updateField('order_rules', 'busy_mode_threshold', Number(v))} />
        <RuleToggle label={tx('rules.order.autoBusy', 'Auto busy mode')} value={settings.order_rules?.auto_busy_mode as boolean ?? true}
          onChange={(v) => updateField('order_rules', 'auto_busy_mode', v)} />
      </RulesCard>

      {/* Feature Flags */}
      <RulesCard title={tx('rules.featureFlagsTitle', 'Feature Flags')} icon={Sparkles} onSave={() => save('features')} saving={saving} saved={savedKey === 'features'}>
        {Object.entries(settings.features ?? {}).filter(([, v]) => typeof v === 'boolean').map(([key, val]) => (
          <RuleToggle key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            value={val as boolean} onChange={(v) => updateField('features', key, v)} />
        ))}
      </RulesCard>

      {/* Taxes & Fees */}
      <RulesCard title={tx('rules.taxesTitle', 'Taxes & Fees')} icon={FileText} onSave={() => save('taxes_fees')} saving={saving} saved={savedKey === 'taxes_fees'}>
        <RuleField label={tx('rules.taxes.vatRate', 'VAT Rate (%)')} value={settings.taxes_fees?.vat_rate as number ?? 19}
          onChange={(v) => updateField('taxes_fees', 'vat_rate', Number(v))} />
        <RuleField label={tx('rules.taxes.transFeeFixed', 'Transaction Processing Fee (DZD)')} value={settings.taxes_fees?.transaction_fee_fixed as number ?? 20}
          onChange={(v) => updateField('taxes_fees', 'transaction_fee_fixed', Number(v))} />
        <RuleField label={tx('rules.taxes.transFeePercent', 'Payment Gateway Comm. (%)')} value={settings.taxes_fees?.transaction_fee_percent as number ?? 1.5}
          onChange={(v) => updateField('taxes_fees', 'transaction_fee_percent', Number(v))} />
      </RulesCard>

      {/* Driver Commission & Compensation */}
      <RulesCard title={tx('rules.driverRulesTitle', 'Driver Commission & Rules')} icon={Truck} onSave={() => save('driver_rules')} saving={saving} saved={savedKey === 'driver_rules'}>
        <RuleField label={tx('rules.driver.basePay', 'Driver Base Pay per Order (DZD)')} value={settings.driver_rules?.base_delivery_pay as number ?? 120}
          onChange={(v) => updateField('driver_rules', 'base_delivery_pay', Number(v))} />
        <RuleField label={tx('rules.driver.payPerKm', 'Driver Pay per km (DZD)')} value={settings.driver_rules?.per_km_delivery_pay as number ?? 15}
          onChange={(v) => updateField('driver_rules', 'per_km_delivery_pay', Number(v))} />
        <RuleField label={tx('rules.driver.commissionRate', 'Driver Commission Cut (%)')} value={((settings.driver_rules?.driver_commission_rate as number ?? 0.10) * 100).toFixed(1)}
          onChange={(v) => updateField('driver_rules', 'driver_commission_rate', Number(v) / 100)} />
        <RuleToggle label={tx('rules.driver.autoAssign', 'Drivers Auto-assigned')} value={settings.driver_rules?.auto_assign_drivers as boolean ?? true}
          onChange={(v) => updateField('driver_rules', 'auto_assign_drivers', v)} />
      </RulesCard>

      {/* Loyalty & Referral Configuration */}
      <RulesCard title={tx('rules.loyaltyTitle', 'Loyalty & Referral Program')} icon={Gift} onSave={() => save('loyalty_referral')} saving={saving} saved={savedKey === 'loyalty_referral'}>
        <RuleToggle label={tx('rules.loyalty.enabled', 'Enable Loyalty Points')} value={settings.loyalty_referral?.loyalty_enabled as boolean ?? true}
          onChange={(v) => updateField('loyalty_referral', 'loyalty_enabled', v)} />
        <RuleField label={tx('rules.loyalty.pointsPerHundred', 'Loyalty Points earned per 100 DZD')} value={settings.loyalty_referral?.points_per_hundred as number ?? 5}
          onChange={(v) => updateField('loyalty_referral', 'points_per_hundred', Number(v))} />
        <RuleField label={tx('rules.loyalty.pointValueDzd', 'DZD Cash Value per 1 Point')} value={settings.loyalty_referral?.point_value_dzd as number ?? 1}
          onChange={(v) => updateField('loyalty_referral', 'point_value_dzd', Number(v))} />
        <RuleToggle label={tx('rules.loyalty.referralEnabled', 'Enable Referral Discounts')} value={settings.loyalty_referral?.referral_enabled as boolean ?? true}
          onChange={(v) => updateField('loyalty_referral', 'referral_enabled', v)} />
        <RuleField label={tx('rules.loyalty.referrerReward', 'Referrer Reward (DZD)')} value={settings.loyalty_referral?.referrer_reward as number ?? 200}
          onChange={(v) => updateField('loyalty_referral', 'referrer_reward', Number(v))} />
        <RuleField label={tx('rules.loyalty.refereeDiscount', 'Referee Sign-up Discount (DZD)')} value={settings.loyalty_referral?.referee_discount as number ?? 150}
          onChange={(v) => updateField('loyalty_referral', 'referee_discount', Number(v))} />
        <RuleField label={tx('rules.loyalty.minOrderToRedeem', 'Min Order to Redeem (DZD)')} value={settings.loyalty_referral?.min_order_value as number ?? 800}
          onChange={(v) => updateField('loyalty_referral', 'min_order_value', Number(v))} />
      </RulesCard>
    </div>
  );
}

function RulesCard({ title, icon: Icon, children, onSave, saving, saved }: {
  title: string; icon: React.ElementType; children: React.ReactNode; onSave: () => void; saving: boolean; saved: boolean;
}) {
  const { tx } = useAdminT();
  return (
    <div className="kiyo-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>
        </div>
        <button onClick={onSave} disabled={saving} className="kiyo-btn-primary text-xs">
          {saving ? <Spinner className="h-3 w-3" /> : saved ? <CheckCircle className="h-3 w-3" /> : null}
          {saved ? tx('common.saved', 'Saved!') : tx('common.save', 'Save')}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function RuleField({ label, value, onChange, type = 'number', placeholder }: { label: string; value: string | number; onChange: (v: string) => void; type?: 'number' | 'text'; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:border-ember-500 focus:outline-none"
      />
    </div>
  );
}

function RuleToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-100 bg-white px-3 py-2">
      <span className="text-sm font-medium text-ink-700">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${value ? 'bg-ember-500' : 'bg-ink-200'}`}
        role="switch"
        aria-checked={value}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

// ===================== ANALYTICS =====================
function AnalyticsTab() {
  const { t } = useT();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc('get_platform_analytics');
      if (e) throw e;
      setAnalytics(data as Analytics);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;
  if (!analytics) return null;

  const totalOrders = analytics.orders.total || 1;
  const cancelRate = ((analytics.orders.cancelled / totalOrders) * 100).toFixed(1);
  const deliveryRate = ((analytics.orders.delivered / totalOrders) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 font-display text-base font-bold text-ink-900">Customer Analytics</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Users} label="Total Customers" value={String(analytics.users.customers)} />
          <StatCard icon={Users} label="Restaurant Owners" value={String(analytics.users.owners)} />
          <StatCard icon={Users} label="Suspended" value={String(analytics.users.suspended)} accent="error" />
          <StatCard icon={Users} label="Total Users" value={String(analytics.users.total)} />
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-display text-base font-bold text-ink-900">Restaurant Analytics</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Store} label="Total" value={String(analytics.restaurants.total)} />
          <StatCard icon={Store} label="Published" value={String(analytics.restaurants.published)} accent="sage" />
          <StatCard icon={Store} label="Pending" value={String(analytics.restaurants.pending)} accent="warning" />
          <StatCard icon={BadgeCheck} label="Verified" value={String(analytics.restaurants.verified)} />
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-display text-base font-bold text-ink-900">Order Analytics</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={ShoppingBag} label="Total Orders" value={String(analytics.orders.total)} />
          <StatCard icon={ShoppingBag} label="Today" value={String(analytics.orders.today)} />
          <StatCard icon={AlertTriangle} label={`Cancelled (${cancelRate}%)`} value={String(analytics.orders.cancelled)} accent="error" />
          <StatCard icon={CheckCircle} label={`Delivered (${deliveryRate}%)`} value={String(analytics.orders.delivered)} accent="sage" />
        </div>
      </div>
    </div>
  );
}

// ===================== SETTLEMENTS =====================
function SettlementsTab() {
  const { t } = useT();
  const [overview, setOverview] = useState<{
    total_owed: number; total_paid: number; overdue_count: number; pending_count: number; paid_count: number;
    recent: Array<{
      id: string; restaurant_id: string; restaurant_name: string;
      period_start: string; period_end: string;
      gross_sales: string; commission: string; payout: string;
      amount_owed: string; amount_paid: string; balance: string;
      status: string; due_date: string | null; settled_at: string | null;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc('get_settlement_overview');
      if (e) throw e;
      setOverview(data as typeof overview);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const markPaid = async (id: string) => {
    setActingId(id);
    try {
      const { error: e } = await supabase.rpc('mark_settlement_paid', {
        p_settlement_id: id, p_amount: null, p_notes: 'Marked as paid by admin',
      });
      if (e) throw e;
      void load();
    } finally {
      setActingId(null);
    }
  };

  if (loading) return <Skeleton count={3} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;
  if (!overview) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Clock} label="Pending" value={String(overview.pending_count)} accent="warning" />
        <StatCard icon={AlertTriangle} label="Overdue" value={String(overview.overdue_count)} accent="error" />
        <StatCard icon={CheckCircle} label="Paid" value={String(overview.paid_count)} accent="sage" />
        <StatCard icon={DollarSign} label="Total Owed" value={DZD(overview.total_owed)} accent="ember" />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink-900">Settlement History</h3>
          <button onClick={exportSettlementsCSV} className="kiyo-btn-secondary">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
        {overview.recent.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">No settlements yet</div>
        ) : (
          <div className="kiyo-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3">Restaurant</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {overview.recent.map((s) => (
                  <tr key={s.id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-3 font-medium text-ink-900">{s.restaurant_name}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {s.period_start} → {s.period_end}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-700">{DZD(Number(s.gross_sales))}</td>
                    <td className="px-4 py-3 text-right text-ember-600">{DZD(Number(s.commission))}</td>
                    <td className="px-4 py-3 text-right font-medium text-ink-900">{DZD(Number(s.balance))}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.status === 'paid' ? 'bg-sage-500/10 text-sage-600' :
                        s.status === 'overdue' ? 'bg-error-500/10 text-error-600' :
                        s.status === 'partially_paid' ? 'bg-ember-500/10 text-ember-600' :
                        'bg-ink-100 text-ink-500'
                      }`}>{s.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status !== 'paid' && (
                        <button
                          onClick={() => markPaid(s.id)}
                          disabled={actingId === s.id}
                          className="kiyo-btn-primary bg-sage-500 text-xs hover:bg-sage-600"
                        >
                          {actingId === s.id ? <Spinner className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  function exportSettlementsCSV() {
    if (!overview) return;
    const rows = [
      ['Restaurant', 'Period Start', 'Period End', 'Gross Sales', 'Commission', 'Payout', 'Amount Owed', 'Amount Paid', 'Balance', 'Status', 'Due Date'],
      ...overview.recent.map((s) => [
        s.restaurant_name, s.period_start, s.period_end,
        s.gross_sales, s.commission, s.payout,
        s.amount_owed, s.amount_paid, s.balance, s.status, s.due_date ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kiyo-settlements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ===================== MARKETING =====================
type MarketingCampaign = {
  id: string;
  name: string;
  campaign_type: string;
  target_audience: string;
  content: Record<string, unknown>;
  is_active: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
  sent_count: number;
  created_at: string;
};

type FeatureFlag = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  rollout_percentage: number;
};

type SubscriptionPlan = {
  id: string;
  name: string;
  plan_type: string;
  price_monthly: string;
  features: Record<string, unknown>;
  is_active: boolean;
};

function MarketingTab() {
  const { t } = useT();
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newPromo, setNewPromo] = useState({ code: '', description: '', discount_type: 'percentage', discount_value: '10', min_order: '0', max_discount: '', valid_until: '' });
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: '', type: 'push', audience: 'all', content: '' });
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: '', type: 'customer', price: '0', features: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [promosRes, campaignsRes, flagsRes, plansRes] = await Promise.all([
        supabase.from('promo_codes').select('*').order('created_at', { ascending: false }),
        supabase.from('marketing_campaigns').select('*').order('created_at', { ascending: false }),
        supabase.from('feature_flags').select('*').order('key'),
        supabase.from('subscription_plans').select('*').order('plan_type, name'),
      ]);
      if (promosRes.error) throw promosRes.error;
      setPromos((promosRes.data as PromoCode[]) ?? []);
      setCampaigns((campaignsRes.data as MarketingCampaign[]) ?? []);
      setFlags((flagsRes.data as FeatureFlag[]) ?? []);
      setPlans((plansRes.data as SubscriptionPlan[]) ?? []);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const createPromo = async () => {
    try {
      const { error: e } = await supabase.from('promo_codes').insert({
        code: newPromo.code.toUpperCase(),
        description: newPromo.description || null,
        discount_type: newPromo.discount_type,
        discount_value: Number(newPromo.discount_value),
        min_order_amount: Number(newPromo.min_order),
        max_discount: newPromo.max_discount ? Number(newPromo.max_discount) : null,
        valid_until: newPromo.valid_until || null,
      });
      if (e) throw e;
      setShowForm(false);
      setNewPromo({ code: '', description: '', discount_type: 'percentage', discount_value: '10', min_order: '0', max_discount: '', valid_until: '' });
      void load();
    } catch {
      setError(t('error.genericBody'));
    }
  };

  const togglePromo = async (p: PromoCode) => {
    try {
      const { error: e } = await supabase.from('promo_codes').update({ is_active: !p.is_active }).eq('id', p.id);
      if (e) throw e;
      setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
    } catch { /* non-fatal */ }
  };

  const createCampaign = async () => {
    try {
      const { error: e } = await supabase.from('marketing_campaigns').insert({
        name: newCampaign.name,
        campaign_type: newCampaign.type,
        target_audience: newCampaign.audience,
        content: { message: newCampaign.content },
      });
      if (e) throw e;
      setShowCampaignForm(false);
      setNewCampaign({ name: '', type: 'push', audience: 'all', content: '' });
      void load();
    } catch {
      setError(t('error.genericBody'));
    }
  };

  const toggleCampaign = async (c: MarketingCampaign) => {
    try {
      const { error: e } = await supabase.from('marketing_campaigns').update({ is_active: !c.is_active }).eq('id', c.id);
      if (e) throw e;
      setCampaigns((prev) => prev.map((x) => x.id === c.id ? { ...x, is_active: !x.is_active } : x));
    } catch { /* non-fatal */ }
  };

  const toggleFlag = async (f: FeatureFlag) => {
    try {
      const { error: e } = await supabase.from('feature_flags').update({ is_enabled: !f.is_enabled }).eq('id', f.id);
      if (e) throw e;
      setFlags((prev) => prev.map((x) => x.id === f.id ? { ...x, is_enabled: !x.is_enabled } : x));
    } catch { /* non-fatal */ }
  };

  const createPlan = async () => {
    try {
      const { error: e } = await supabase.from('subscription_plans').insert({
        name: newPlan.name,
        plan_type: newPlan.type,
        price_monthly: Number(newPlan.price),
        features: { description: newPlan.features },
      });
      if (e) throw e;
      setShowPlanForm(false);
      setNewPlan({ name: '', type: 'customer', price: '0', features: '' });
      void load();
    } catch {
      setError(t('error.genericBody'));
    }
  };

  const togglePlan = async (p: SubscriptionPlan) => {
    try {
      await supabase.from('subscription_plans').update({ is_active: !p.is_active }).eq('id', p.id);
      setPlans((prev) => prev.map((x) => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
    } catch { /* non-fatal */ }
  };

  if (loading) return <Skeleton count={3} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink-900">Promo Codes</h3>
        <button onClick={() => setShowForm((v) => !v)} className="kiyo-btn-primary">
          <Tag className="h-4 w-4" />
          <span className="hidden sm:inline">New Code</span>
        </button>
      </div>

      {showForm && (
        <div className="kiyo-card space-y-3 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Code</label>
              <input value={newPromo.code} onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                placeholder="SUMMER10" className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm uppercase focus:border-ember-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Description</label>
              <input value={newPromo.description} onChange={(e) => setNewPromo({ ...newPromo, description: e.target.value })}
                placeholder="Summer 10% off" className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Type</label>
              <select value={newPromo.discount_type} onChange={(e) => setNewPromo({ ...newPromo, discount_type: e.target.value })}
                className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed (DZD)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Value</label>
              <input type="number" value={newPromo.discount_value} onChange={(e) => setNewPromo({ ...newPromo, discount_value: e.target.value })}
                className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Min order (DZD)</label>
              <input type="number" value={newPromo.min_order} onChange={(e) => setNewPromo({ ...newPromo, min_order: e.target.value })}
                className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Max discount (DZD)</label>
              <input type="number" value={newPromo.max_discount} onChange={(e) => setNewPromo({ ...newPromo, max_discount: e.target.value })}
                placeholder="No limit" className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Valid until</label>
              <input type="date" value={newPromo.valid_until} onChange={(e) => setNewPromo({ ...newPromo, valid_until: e.target.value })}
                className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createPromo} className="kiyo-btn-primary">Create</button>
            <button onClick={() => setShowForm(false)} className="kiyo-btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {promos.length === 0 ? (
        <div className="kiyo-card p-6 text-center text-sm text-ink-400">No promo codes yet</div>
      ) : (
        <div className="kiyo-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">Used</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {promos.map((p) => (
                <tr key={p.id} className="hover:bg-ink-50/50">
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-ink-900">{p.code}</div>
                    {p.description && <div className="text-xs text-ink-400">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3 capitalize text-ink-600">{p.discount_type}</td>
                  <td className="px-4 py-3 text-right text-ink-700">
                    {p.discount_type === 'percentage' ? `${p.discount_value}%` : `${p.discount_value} DZD`}
                  </td>
                  <td className="px-4 py-3 text-right text-ink-500">
                    {p.used_count}{p.usage_limit ? ` / ${p.usage_limit}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.is_active ? 'bg-sage-500/10 text-sage-600' : 'bg-ink-100 text-ink-500'
                    }`}>{p.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => togglePromo(p)} className="kiyo-btn-secondary text-xs">
                      {p.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Marketing Campaigns */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink-900">Marketing Campaigns</h3>
          <button onClick={() => setShowCampaignForm((v) => !v)} className="kiyo-btn-primary">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">New Campaign</span>
          </button>
        </div>

        {showCampaignForm && (
          <div className="kiyo-card mt-3 space-y-3 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500">Name</label>
                <input value={newCampaign.name} onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="Summer Sale" className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500">Type</label>
                <select value={newCampaign.type} onChange={(e) => setNewCampaign({ ...newCampaign, type: e.target.value })}
                  className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none">
                  <option value="push">Push Notification</option>
                  <option value="email">Email</option>
                  <option value="in_app">In-App Banner</option>
                  <option value="loyalty">Loyalty Bonus</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500">Audience</label>
                <select value={newCampaign.audience} onChange={(e) => setNewCampaign({ ...newCampaign, audience: e.target.value })}
                  className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none">
                  <option value="all">All Users</option>
                  <option value="customers">Customers Only</option>
                  <option value="owners">Restaurant Owners</option>
                  <option value="inactive">Inactive Users</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500">Message</label>
                <input value={newCampaign.content} onChange={(e) => setNewCampaign({ ...newCampaign, content: e.target.value })}
                  placeholder="Get 20% off your next order!" className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createCampaign} className="kiyo-btn-primary">Create</button>
              <button onClick={() => setShowCampaignForm(false)} className="kiyo-btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        {campaigns.length === 0 ? (
          <div className="kiyo-card mt-3 p-6 text-center text-sm text-ink-400">No campaigns yet</div>
        ) : (
          <div className="kiyo-card mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Audience</th>
                  <th className="px-4 py-3 text-right">Sent</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-3 font-medium text-ink-900">{c.name}</td>
                    <td className="px-4 py-3 capitalize text-ink-600">{c.campaign_type.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-ink-600">{c.target_audience}</td>
                    <td className="px-4 py-3 text-right text-ink-500">{c.sent_count}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.is_active ? 'bg-sage-500/10 text-sage-600' : 'bg-ink-100 text-ink-500'
                      }`}>{c.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toggleCampaign(c)} className="kiyo-btn-secondary text-xs">
                        {c.is_active ? 'Stop' : 'Start'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Feature Flags */}
      <div className="mt-8">
        <h3 className="font-display text-base font-bold text-ink-900">Feature Flags</h3>
        <p className="mb-3 text-xs text-ink-500">Toggle platform features without code changes.</p>
        {flags.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">No feature flags configured</div>
        ) : (
          <div className="kiyo-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3">Feature</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Rollout</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {flags.map((f) => (
                  <tr key={f.id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-bold text-ink-900">{f.key}</div>
                      <div className="text-xs text-ink-600">{f.name}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">{f.description || '—'}</td>
                    <td className="px-4 py-3 text-right text-ink-600">{f.rollout_percentage}%</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        f.is_enabled ? 'bg-sage-500/10 text-sage-600' : 'bg-ink-100 text-ink-500'
                      }`}>{f.is_enabled ? 'Enabled' : 'Disabled'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toggleFlag(f)} className="kiyo-btn-secondary text-xs">
                        {f.is_enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subscription Plans */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink-900">Subscription Plans</h3>
          <button onClick={() => setShowPlanForm((v) => !v)} className="kiyo-btn-primary">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">New Plan</span>
          </button>
        </div>

        {showPlanForm && (
          <div className="kiyo-card mt-3 space-y-3 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500">Plan Name</label>
                <input value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                  placeholder="Premium" className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500">Plan Type</label>
                <select value={newPlan.type} onChange={(e) => setNewPlan({ ...newPlan, type: e.target.value })}
                  className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none">
                  <option value="customer">Customer</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="driver">Driver</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500">Monthly Price (DZD)</label>
                <input type="number" value={newPlan.price} onChange={(e) => setNewPlan({ ...newPlan, price: e.target.value })}
                  placeholder="1000" className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500">Features</label>
                <input value={newPlan.features} onChange={(e) => setNewPlan({ ...newPlan, features: e.target.value })}
                  placeholder="Free delivery, priority support" className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createPlan} className="kiyo-btn-primary">Create</button>
              <button onClick={() => setShowPlanForm(false)} className="kiyo-btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        {plans.length === 0 ? (
          <div className="kiyo-card mt-3 p-6 text-center text-sm text-ink-400">No subscription plans yet</div>
        ) : (
          <div className="kiyo-card mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Price/mo</th>
                  <th className="px-4 py-3">Features</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-3 font-medium text-ink-900">{p.name}</td>
                    <td className="px-4 py-3 capitalize text-ink-600">{p.plan_type}</td>
                    <td className="px-4 py-3 text-right text-ink-700">{p.price_monthly} DZD</td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {(p.features as Record<string, string>)?.description || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.is_active ? 'bg-sage-500/10 text-sage-600' : 'bg-ink-100 text-ink-500'
                      }`}>{p.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => togglePlan(p)} className="kiyo-btn-secondary text-xs">
                        {p.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== ALERTS =====================
function AlertsTab() {
  const { t } = useT();
  const [alerts, setAlerts] = useState<{
    failed_orders: Array<{ id: string; restaurant_id: string; total: string; status: string; created_at: string }>;
    high_cancellation_restaurants: Array<{ restaurant_id: string; name: string; cancelled: number; total: number; rate: number }>;
    suspicious_activity: Array<{ user_id: string; order_count: number; window: string }>;
    unread_notifications: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc('get_admin_alerts');
      if (e) throw e;
      setAlerts(data as typeof alerts);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Skeleton count={3} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;
  if (!alerts) return null;

  return (
    <div className="space-y-6">
      {/* Failed orders */}
      <div>
        <h3 className="mb-3 font-display text-base font-bold text-ink-900">Failed Orders (24h)</h3>
        {alerts.failed_orders.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">No failed orders in the last 24 hours</div>
        ) : (
          <ul className="kiyo-card divide-y divide-ink-100">
            {alerts.failed_orders.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-error-500/10 text-error-600">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-800">
                    #{o.id.slice(0, 8)} · {o.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-ink-400">{new Date(o.created_at).toLocaleString()}</span>
                </div>
                <span className="text-sm font-medium text-ink-700">{o.total} DZD</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* High cancellation restaurants */}
      <div>
        <h3 className="mb-3 font-display text-base font-bold text-ink-900">High Cancellation Rate (7d)</h3>
        {alerts.high_cancellation_restaurants.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">No restaurants with high cancellation rates</div>
        ) : (
          <ul className="kiyo-card divide-y divide-ink-100">
            {alerts.high_cancellation_restaurants.map((r) => (
              <li key={r.restaurant_id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-ember-500/10 text-ember-600">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-800">{r.name}</span>
                  <span className="text-xs text-ink-400">{r.cancelled} cancelled / {r.total} total orders</span>
                </div>
                <span className="rounded-full bg-error-500/10 px-2 py-0.5 text-xs font-bold text-error-600">
                  {r.rate}% cancel rate
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Suspicious activity */}
      <div>
        <h3 className="mb-3 font-display text-base font-bold text-ink-900">Suspicious Activity (1h)</h3>
        {alerts.suspicious_activity.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">No suspicious activity detected</div>
        ) : (
          <ul className="kiyo-card divide-y divide-ink-100">
            {alerts.suspicious_activity.map((s) => (
              <li key={s.user_id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-error-500/10 text-error-600">
                  <Ban className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-800">
                    User {s.user_id.slice(0, 8)}...
                  </span>
                  <span className="text-xs text-ink-400">{s.order_count} orders in {s.window}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ===================== ADMIN SUPPORT =====================
function AdminSupportTab() {
  const { t } = useT();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data, error: e } = await q;
      if (e) throw e;
      setTickets((data as SupportTicket[]) ?? []);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => { void load(); }, [load]);

  if (selectedId) {
    return <AdminTicketDetail ticketId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink-900">Support Inbox</h3>
        <div className="flex gap-1">
          {(['all','open','in_progress','resolved','closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === f ? 'bg-ember-500 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Skeleton count={4} /> : error ? (
        <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />
      ) : tickets.length === 0 ? (
        <div className="kiyo-card p-8 text-center text-sm text-ink-400">No support tickets</div>
      ) : (
        <ul className="space-y-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button
                onClick={() => setSelectedId(ticket.id)}
                className="kiyo-card flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-ink-50/50"
              >
                <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                  ticket.priority === 'urgent' ? 'bg-error-500/10 text-error-600' :
                  ticket.priority === 'high' ? 'bg-ember-500/10 text-ember-600' :
                  'bg-ink-100 text-ink-500'
                }`}>
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="truncate text-sm font-semibold text-ink-900">{ticket.subject}</h4>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                      ticket.status === 'open' ? 'bg-warning-500/10 text-warning-600' :
                      ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                      ticket.status === 'resolved' ? 'bg-sage-500/10 text-sage-600' :
                      'bg-ink-100 text-ink-500'
                    }`}>{ticket.status.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-500">{ticket.body}</p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-400">
                    <span className="capitalize">{ticket.category}</span>
                    <span>·</span>
                    <span className="capitalize">{ticket.priority}</span>
                    <span>·</span>
                    <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminTicketDetail({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { t } = useT();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<Array<{ id: string; ticket_id: string; sender_id: string; body: string; is_admin: boolean; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketRes, msgRes] = await Promise.all([
        supabase.from('support_tickets').select('*').eq('id', ticketId).single(),
        supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
      ]);
      if (ticketRes.error) throw ticketRes.error;
      if (msgRes.error) throw msgRes.error;
      setTicket(ticketRes.data as SupportTicket);
      setMessages(msgRes.data as typeof messages ?? []);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [ticketId, t]);

  useEffect(() => { void load(); }, [load]);

  const sendReply = async () => {
    if (reply.trim().length < 1) return;
    setSending(true);
    try {
      const { error: e } = await supabase.rpc('reply_to_ticket', {
        p_ticket_id: ticketId, p_body: reply.trim(), p_is_admin: true,
      });
      if (e) throw e;
      setReply('');
      void load();
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      const { error: e } = await supabase.rpc('update_ticket_status', {
        p_ticket_id: ticketId, p_status: status,
      });
      if (e) throw e;
      void load();
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <Skeleton count={3} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;
  if (!ticket) return null;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
        <ChevronLeft className="h-4 w-4" /> Back to inbox
      </button>

      <div className="kiyo-card p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink-900">{ticket.subject}</h2>
          <div className="flex gap-1">
            {ticket.status !== 'resolved' && (
              <button onClick={() => updateStatus('resolved')} disabled={updating}
                className="rounded-lg bg-sage-500/10 px-2.5 py-1 text-xs font-medium text-sage-600 hover:bg-sage-500/20">
                {updating ? <Spinner className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />} Resolve
              </button>
            )}
            {ticket.status !== 'closed' && (
              <button onClick={() => updateStatus('closed')} disabled={updating}
                className="rounded-lg bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-ink-200">
                Close
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-sm text-ink-600">{ticket.body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-ink-400">
          <span className="capitalize rounded bg-ink-100 px-1.5 py-0.5">{ticket.category}</span>
          <span className="capitalize rounded bg-ink-100 px-1.5 py-0.5">{ticket.priority} priority</span>
          {ticket.order_id && <span className="flex items-center gap-1 rounded bg-ink-100 px-1.5 py-0.5"><Package className="h-3 w-3" /> {ticket.order_id.slice(0, 8)}</span>}
          <span>{new Date(ticket.created_at).toLocaleString()}</span>
        </div>
      </div>

      <div className="kiyo-card">
        <div className="border-b border-ink-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-ink-900">Conversation</h3>
        </div>
        <div className="max-h-96 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">No messages yet. Reply below.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.is_admin ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  m.is_admin ? 'bg-ember-500 text-white' : 'bg-ink-100 text-ink-800'
                }`}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${m.is_admin ? 'text-ember-100' : 'text-ink-400'}`}>
                    {m.is_admin ? 'Admin' : 'User'} · {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {ticket.status !== 'closed' && (
        <div className="kiyo-card flex items-end gap-2 p-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder="Type your reply..."
            className="flex-1 resize-none rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
          />
          <button onClick={sendReply} disabled={sending || reply.trim().length < 1} className="kiyo-btn-primary flex-shrink-0">
            {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ===================== MONITORING =====================
function MonitoringTab() {
  const { t } = useT();
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (e) throw e;
      setAudit((data as AuditLog[]) ?? []);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;

  return (
    <div className="space-y-6">
      {/* System health */}
      <PlatformHealthPanel />

      {/* Audit log */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink-900">Audit Logs</h3>
          <Link to="/admin/audit" className="inline-flex items-center gap-1 text-xs font-semibold text-ember-600 hover:text-ember-700">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {audit.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">No audit entries</div>
        ) : (
          <ul className="kiyo-card divide-y divide-ink-100">
            {audit.map((log) => (
              <li key={log.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                  <Activity className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-800">
                    {log.action.replace(/_/g, ' ')}
                  </span>
                  {log.target_type && (
                    <span className="text-xs text-ink-400">{log.target_type}</span>
                  )}
                </div>
                <span className="flex-shrink-0 text-xs text-ink-400">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


// ===================== GEOGRAPHY TAB =====================
type DeliveryZone = {
  id: string;
  name: string;
  wilaya_id: number | null;
  base_fee: string;
  per_km_fee: string;
  min_fee: string;
  is_active: boolean;
};

type WilayaStats = {
  id: number;
  name_en: string;
  name_fr: string;
  name_ar: string;
  code: string;
  is_active: boolean;
  restaurant_count: number;
  customer_count: number;
  order_count: number;
};

function GeographyTab() {
  const { t, currentLocale } = useT();
  const { tx } = useAdminT();
  const [wilayaStats, setWilayaStats] = useState<WilayaStats[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [newZone, setNewZone] = useState({ name: '', base_fee: '50', per_km_fee: '10', min_fee: '50' });

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      setError(null);
      try {
        const [wilayasRes, restaurantCountsRes, profileWilayasRes, zonesRes] = await Promise.all([
          supabase.from('wilayas').select('*').order('name_fr', { ascending: true }),
          supabase.from('restaurants').select('wilaya_id').eq('status', 'published'),
          supabase.from('profiles').select('selected_wilaya_id').not('selected_wilaya_id', 'is', null),
          supabase.from('delivery_zones').select('*').order('name'),
        ]);

        const wilayas = wilayasRes.data;
        const restaurantCounts = restaurantCountsRes.data;
        const profileWilayas = profileWilayasRes.data;

        // Build restaurant wilaya lookup
        const restaurantWilayaMap: Record<string, number> = {};
        (restaurantCounts ?? []).forEach((r: { wilaya_id: number | null }) => {
          if (r.wilaya_id) {
            restaurantWilayaMap[r.wilaya_id] = (restaurantWilayaMap[r.wilaya_id] || 0) + 1;
          }
        });

        // Build profile wilaya counts
        const profileWilayaMap: Record<number, number> = {};
        (profileWilayas ?? []).forEach((p: { selected_wilaya_id: number }) => {
          profileWilayaMap[p.selected_wilaya_id] = (profileWilayaMap[p.selected_wilaya_id] || 0) + 1;
        });

        // Combine into stats
        const stats: WilayaStats[] = (wilayas ?? []).map((w) => ({
          id: w.id,
          name_en: w.name_en,
          name_fr: w.name_fr,
          name_ar: w.name_ar,
          code: w.code,
          is_active: w.is_active,
          restaurant_count: restaurantWilayaMap[w.id] || 0,
          customer_count: profileWilayaMap[w.id] || 0,
          order_count: 0,
        }));

        setWilayaStats(stats);
        setDeliveryZones((zonesRes.data as DeliveryZone[]) ?? []);
      } catch {
        setError('Failed to load geographic stats');
      } finally {
        setLoading(false);
      }
    }
    void loadStats();
  }, []);

  const createZone = async () => {
    try {
      const { error: e } = await supabase.from('delivery_zones').insert({
        name: newZone.name,
        base_fee: Number(newZone.base_fee),
        per_km_fee: Number(newZone.per_km_fee),
        min_fee: Number(newZone.min_fee),
      });
      if (e) throw e;
      setShowZoneForm(false);
      setNewZone({ name: '', base_fee: '50', per_km_fee: '10', min_fee: '50' });
      // Reload zones
      const { data } = await supabase.from('delivery_zones').select('*').order('name');
      setDeliveryZones((data as DeliveryZone[]) ?? []);
    } catch {
      setError('Failed to create zone');
    }
  };

  const toggleZone = async (z: DeliveryZone) => {
    try {
      await supabase.from('delivery_zones').update({ is_active: !z.is_active }).eq('id', z.id);
      setDeliveryZones((prev) => prev.map((x) => x.id === z.id ? { ...x, is_active: !x.is_active } : x));
    } catch { /* non-fatal */ }
  };

  const toggleWilaya = async (w: WilayaStats) => {
    try {
      const { error: e } = await supabase.from('wilayas').update({ is_active: !w.is_active }).eq('id', w.id);
      if (e) throw e;
      setWilayaStats((prev) => prev.map((x) => x.id === w.id ? { ...x, is_active: !x.is_active } : x));
    } catch {
      setError('Failed to update Wilaya status');
    }
  };

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title="Error" message={error} onRetry={() => setLoading(true)} retryLabel="Retry" />;

  const totalRestaurants = wilayaStats.reduce((sum, w) => sum + w.restaurant_count, 0);
  const activeWilayas = wilayaStats.filter((w) => w.is_active);
  const wilayasWithRestaurants = wilayaStats.filter((w) => w.restaurant_count > 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={MapPin} label={tx('geography.activeWilayas', 'Active Wilayas')} value={String(activeWilayas.length)} accent="ember" />
        <StatCard icon={Store} label={tx('geography.wilayasWithRestaurants', 'Wilayas with Restaurants')} value={String(wilayasWithRestaurants.length)} />
        <StatCard icon={Users} label={tx('geography.totalRestaurants', 'Total Restaurants')} value={String(totalRestaurants)} />
        <StatCard icon={TrendingUp} label={tx('geography.coverage', 'Coverage')} value={`${Math.round((wilayasWithRestaurants.length / 58) * 100)}%`} />
      </div>

      {/* Wilaya list */}
      <div className="kiyo-card overflow-hidden p-0">
        <div className="border-b border-ink-100 px-4 py-3">
          <h3 className="font-display text-sm font-bold text-ink-900">{tx('geography.wilayaCoverage', 'Wilaya Coverage')}</h3>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ink-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-ink-500">{tx('geography.tbl.wilaya', 'Wilaya')}</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-ink-500">{tx('geography.tbl.code', 'Code')}</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-ink-500">{tx('geography.tbl.restaurants', 'Restaurants')}</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-ink-500">{tx('geography.tbl.customers', 'Customers')}</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-ink-500">{tx('geography.tbl.status', 'Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {wilayaStats.map((w) => {
                const wName = currentLocale === 'ar' ? w.name_ar : currentLocale === 'fr' ? w.name_fr : w.name_en;
                return (
                  <tr key={w.id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-2 font-medium text-ink-900">{wName}</td>
                    <td className="px-4 py-2 text-center text-ink-500">{w.code}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        w.restaurant_count > 0 ? 'bg-sage-100 text-sage-700' : 'bg-ink-100 text-ink-400'
                      }`}>
                        {w.restaurant_count}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-ink-600">{w.customer_count}</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => toggleWilaya(w)}
                        className="focus:outline-none transition-transform active:scale-95"
                        title="Click to toggle active/inactive"
                      >
                        {w.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-sage-700 hover:bg-sage-200">
                            <CheckCircle className="h-3 w-3" />
                            {tx('geography.active', 'Active')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-500 hover:bg-ink-200">
                            <Ban className="h-3 w-3" />
                            {tx('geography.inactive', 'Inactive')}
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delivery Zones */}
      <div className="kiyo-card">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-ember-500" />
            <h3 className="font-display text-sm font-bold text-ink-900">{tx('geography.deliveryZones', 'Delivery Zones')}</h3>
          </div>
          <button onClick={() => setShowZoneForm((v) => !v)} className="kiyo-btn-primary text-xs">
            {tx('geography.addZone', 'Add Zone')}
          </button>
        </div>
        <p className="mb-3 text-xs text-ink-500">
          {tx('geography.zonesDesc', 'Configure delivery pricing for different zones.')}
        </p>

        {showZoneForm && (
          <div className="mb-3 rounded-lg border border-ink-200 bg-ink-50 p-3">
            <div className="grid grid-cols-4 gap-2">
              <input value={newZone.name} onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                placeholder={tx('geography.zoneName', 'Zone name')} className="rounded border border-ink-200 bg-white px-2 py-1 text-xs text-ink-900 focus:border-ember-500 focus:outline-none" />
              <input type="number" value={newZone.base_fee} onChange={(e) => setNewZone({ ...newZone, base_fee: e.target.value })}
                placeholder={tx('geography.baseFee', 'Base fee')} className="rounded border border-ink-200 bg-white px-2 py-1 text-xs text-ink-900 focus:border-ember-500 focus:outline-none" />
              <input type="number" value={newZone.per_km_fee} onChange={(e) => setNewZone({ ...newZone, per_km_fee: e.target.value })}
                placeholder={tx('geography.perKm', 'Per km')} className="rounded border border-ink-200 bg-white px-2 py-1 text-xs text-ink-900 focus:border-ember-500 focus:outline-none" />
              <input type="number" value={newZone.min_fee} onChange={(e) => setNewZone({ ...newZone, min_fee: e.target.value })}
                placeholder={tx('geography.minFee', 'Min fee')} className="rounded border border-ink-200 bg-white px-2 py-1 text-xs text-ink-900 focus:border-ember-500 focus:outline-none" />
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={createZone} className="kiyo-btn-primary text-xs">{tx('geography.create', 'Create')}</button>
              <button onClick={() => setShowZoneForm(false)} className="kiyo-btn-secondary text-xs">{tx('geography.cancel', 'Cancel')}</button>
            </div>
          </div>
        )}

        {deliveryZones.length === 0 ? (
          <div className="rounded-lg bg-ink-50 p-4 text-center text-xs text-ink-400">{tx('geography.noZones', 'No delivery zones configured')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold text-ink-500">
                  <th className="px-3 py-2">{tx('geography.tbl.zone', 'Zone')}</th>
                  <th className="px-3 py-2 text-right">{tx('geography.tbl.baseFee', 'Base Fee')}</th>
                  <th className="px-3 py-2 text-right">{tx('geography.tbl.perKm', 'Per Km')}</th>
                  <th className="px-3 py-2 text-right">{tx('geography.tbl.minFee', 'Min Fee')}</th>
                  <th className="px-3 py-2 text-center">{tx('geography.tbl.status', 'Status')}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {deliveryZones.map((z) => (
                  <tr key={z.id} className="hover:bg-ink-50/50">
                    <td className="px-3 py-2 font-medium text-ink-900">{z.name}</td>
                    <td className="px-3 py-2 text-right text-ink-600">{z.base_fee} DZD</td>
                    <td className="px-3 py-2 text-right text-ink-600">{z.per_km_fee} DZD</td>
                    <td className="px-3 py-2 text-right text-ink-600">{z.min_fee} DZD</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        z.is_active ? 'bg-sage-100 text-sage-700' : 'bg-ink-100 text-ink-500'
                      }`}>{z.is_active ? tx('geography.active', 'Active') : tx('geography.inactive', 'Inactive')}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => toggleZone(z)} className="text-xs text-ink-500 hover:text-ink-700">
                        {z.is_active ? tx('geography.disable', 'Disable') : tx('geography.enable', 'Enable')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expansion opportunities */}
      <div className="kiyo-card">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-ember-500" />
          <h3 className="font-display text-sm font-bold text-ink-900">{tx('geography.expansionOpportunities', 'Expansion Opportunities')}</h3>
        </div>
        <p className="mb-3 text-xs text-ink-500">
          {tx('geography.expansionDesc', 'Wilayas with customer interest but no restaurants yet.')}
        </p>
        <div className="flex flex-wrap gap-2">
          {wilayaStats
            .filter((w) => w.customer_count > 0 && w.restaurant_count === 0)
            .slice(0, 10)
            .map((w) => {
              const wName = currentLocale === 'ar' ? w.name_ar : currentLocale === 'fr' ? w.name_fr : w.name_en;
              return (
                <span
                  key={w.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-ember-200 bg-ember-50 px-2 py-1 text-xs font-medium text-ember-700"
                >
                  <MapPin className="h-3 w-3" />
                  {wName}
                  <span className="text-ember-500">({w.customer_count} {tx('geography.customersSuffix', 'customers')})</span>
                </span>
              );
            })}
          {wilayaStats.filter((w) => w.customer_count > 0 && w.restaurant_count === 0).length === 0 && (
            <span className="text-xs text-ink-400">{tx('geography.demandServed', 'All customer demand is currently served.')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== SHARED =====================
function StatCard({ icon: Icon, label, value, accent }: {
  icon: React.ElementType; label: string; value: string; accent?: 'ember' | 'sage' | 'warning' | 'error';
}) {
  const accentBg = accent === 'ember' ? 'bg-ember-500/10 text-ember-600' :
    accent === 'sage' ? 'bg-sage-500/10 text-sage-600' :
    accent === 'warning' ? 'bg-ember-500/10 text-ember-600' :
    accent === 'error' ? 'bg-error-500/10 text-error-600' :
    'bg-ink-100 text-ink-700';
  return (
    <div className="kiyo-card p-4">
      <div className="flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${accentBg}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 font-display text-xl font-extrabold text-ink-900">{value}</div>
      <div className="text-xs font-medium text-ink-400">{label}</div>
    </div>
  );
}
