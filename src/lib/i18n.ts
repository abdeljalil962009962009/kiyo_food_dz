export type Locale = 'en' | 'fr' | 'ar';

export type TranslationKey =
  | 'brand.name'
  | 'brand.tagline'
  | 'brand.heroSubtitle'
  | 'brand.heroFeature1Title'
  | 'brand.heroFeature1Desc'
  | 'brand.heroFeature2Title'
  | 'brand.heroFeature2Desc'
  | 'brand.heroFeature3Title'
  | 'brand.heroFeature3Desc'
  | 'brand.heroFeature4Title'
  | 'brand.heroFeature4Desc'
  | 'brand.heroFeature5Title'
  | 'brand.heroFeature5Desc'
  | 'brand.heroFeature6Title'
  | 'brand.heroFeature6Desc'
  | 'brand.whyKiyo'
  | 'brand.seoDescription'
  | 'brand.areaServed'
  // auth
  | 'auth.login'
  | 'auth.signup'
  | 'auth.logout'
  | 'auth.email'
  | 'auth.phone'
  | 'auth.password'
  | 'auth.confirmPassword'
  | 'auth.fullName'
  | 'auth.forgotPassword'
  | 'auth.resetPassword'
  | 'auth.resetPasswordCta'
  | 'auth.continueWithGoogle'
  | 'auth.continueWithApple'
  | 'auth.orContinueWith'
  | 'auth.noAccount'
  | 'auth.haveAccount'
  | 'auth.chooseRole'
  | 'auth.role.customer'
  | 'auth.role.restaurant'
  | 'auth.acceptTerms'
  | 'auth.termsLink'
  | 'auth.privacyLink'
  | 'auth.createAccount'
  | 'auth.signingIn'
  | 'auth.signingUp'
  | 'auth.sendingReset'
  | 'auth.backToLogin'
  | 'auth.checkEmailReset'
  | 'auth.sessionRestoring'
  // auth errors
  | 'auth.error.invalidCredentials'
  | 'auth.error.emailTaken'
  | 'auth.error.weakPassword'
  | 'auth.error.tooManyAttempts'
  | 'auth.error.network'
  | 'auth.error.timeout'
  | 'auth.error.unknown'
  | 'auth.error.passwordMismatch'
  | 'auth.error.acceptTerms'
  | 'auth.error.invalidEmail'
  | 'auth.error.invalidPhone'
  | 'auth.error.emailDelivery'
  | 'auth.error.emailNotConfirmed'
  | 'auth.error.popupBlocked'
  | 'auth.error.providerNotEnabled'
  | 'auth.error.invalidRedirect'
  | 'auth.signupCheckEmailTitle'
  | 'auth.signupCheckEmailBody'
  | 'auth.resetInvalidTitle'
  | 'auth.resetInvalidBody'
  | 'auth.restaurantAccessTitle'
  | 'auth.restaurantAccessBody'
  // nav
  | 'nav.home'
  | 'nav.dashboard'
  | 'nav.profile'
  | 'nav.settings'
  | 'nav.auditLogs'
  | 'nav.users'
  | 'nav.restaurants'
  | 'nav.orders'
  // dashboards
  | 'dash.welcome'
  | 'dash.role'
  | 'dash.customer.title'
  | 'dash.customer.subtitle'
  | 'dash.restaurant.title'
  | 'dash.restaurant.subtitle'
  | 'dash.admin.title'
  | 'dash.admin.subtitle'
  | 'dash.comingSoon'
  | 'dash.accountInfo'
  | 'dash.totalOrders'
  | 'dash.totalRestaurants'
  | 'dash.totalUsers'
  | 'dash.recentActivity'
  // errors / fallbacks
  | 'error.genericTitle'
  | 'error.genericBody'
  | 'error.retry'
  | 'error.reload'
  | 'error.pageNotFound'
  | 'error.pageNotFoundBody'
  | 'error.goHome'
  | 'error.unauthorizedTitle'
  | 'error.unauthorizedBody'
  | 'error.forbiddenTitle'
  | 'error.forbiddenBody'
  // misc
  | 'common.loading'
  | 'common.cancel'
  | 'common.save'
  | 'common.edit'
  | 'common.back'
  | 'common.close'
  | 'common.search'
  | 'common.none'
  | 'common.refunds'
  | 'common.cookies'
  | 'audit.title'
  | 'audit.actor'
  | 'audit.action'
  | 'audit.target'
  | 'audit.time'
  | 'audit.empty'
  // nav
  | 'nav.favorites'
  // marketplace
  | 'market.browse'
  | 'market.openNow'
  | 'market.freeDelivery'
  | 'market.topRated'
  | 'market.empty'
  | 'market.searchPlaceholder'
  | 'market.nearMe'
  | 'market.locationTooWeak'
  | 'restaurant.menu'
  | 'restaurant.owner'
  | 'restaurant.addToCart'
  | 'restaurant.closed'
  | 'restaurant.open'
  | 'restaurant.busy'
  | 'restaurant.reviews'
  | 'restaurant.about'
  | 'restaurant.noMenu'
  | 'restaurant.addCategory'
  | 'restaurant.addItem'
  | 'restaurant.editItem'
  | 'restaurant.newItem'
  | 'restaurant.onboard'
  | 'restaurant.onboard.prompt'
  | 'restaurant.onboard.existingOwnerHelp'
  | 'restaurant.onboard.noOwners'
  | 'restaurant.onboard.invalidName'
  | 'restaurant.onboard.ownerRequired'
  | 'restaurant.onboard.locationTitle'
  | 'restaurant.onboard.locationHelp'
  | 'restaurant.onboard.coordinatesSaved'
  | 'restaurant.onboard.pendingNotice'
  | 'restaurant.phone'
  | 'restaurant.address'
  | 'restaurant.cuisine'
  | 'restaurant.image'
  | 'restaurant.create'
  | 'restaurant.creating'
  | 'restaurant.openRestaurant'
  | 'restaurant.available'
  | 'restaurant.outOfStock'
  | 'restaurant.price'
  | 'restaurant.categoryName'
  | 'restaurant.itemName'
  | 'restaurant.description'
  | 'restaurant.delete'
  | 'restaurant.dashboard'
  | 'restaurant.manageMenu'
  | 'restaurant.waitingOrders'
  | 'restaurant.noOrders'
  | 'restaurant.apply.nav'
  | 'restaurant.apply.title'
  | 'restaurant.apply.subtitle'
  | 'restaurant.apply.name'
  | 'restaurant.apply.legalName'
  | 'restaurant.apply.openingHours'
  | 'restaurant.apply.openingHoursPlaceholder'
  | 'restaurant.apply.logo'
  | 'restaurant.apply.cover'
  | 'restaurant.apply.submit'
  | 'restaurant.apply.submitting'
  | 'restaurant.apply.successTitle'
  | 'restaurant.apply.successBody'
  | 'restaurant.apply.errorName'
  | 'restaurant.apply.errorPhone'
  | 'restaurant.apply.errorAddress'
  | 'restaurant.apply.errorLocation'
  | 'restaurant.apply.errorDelivery'
  | 'restaurant.apply.errorMinOrder'
  | 'map.searchPlaceholder'
  | 'map.useCurrentLocation'
  | 'map.locating'
  | 'map.gps'
  | 'map.searching'
  | 'map.loading'
  | 'map.locationUnavailable'
  | 'map.locationOutsideAlgeria'
  | 'map.gpsWeak'
  | 'map.gpsApproximate'
  | 'map.improvingAccuracy'
  | 'map.restaurantConfirmRequired'
  | 'map.confirmWeakGps'
  | 'map.confirmDraggedPin'
  | 'map.confirmSearchPin'
  | 'map.pinConfirmed'
  | 'map.pinNeedsConfirmation'
  | 'map.confirmPin'
  | 'map.confirmRequired'
  | 'map.tileFallbackActive'
  | 'map.tileReconnecting'
  | 'map.distance'
  | 'map.max'
  | 'map.gpsAccuracy'
  | 'map.heading'
  | 'map.outsideZone'
  | 'map.locationDeliveryZone'
  | 'map.locationUnavailableShort'
  | 'map.trackingRiderEnRoute'
  | 'map.trackingPreparing'
  | 'map.trackingLive'
  | 'map.driverWeakGps'
  | 'map.driverJump'
  | 'map.driverSyncFailed'
  | 'map.driverPermissionRequired'
  | 'map.searchUnavailable'
  | 'map.addressStillLoading'
  | 'map.addressNotFound'
  | 'map.addressApproximate'
  | 'map.locationSelector'
  | 'map.restaurantMarker'
  | 'map.currentPosition'
  | 'map.satelliteView'
  | 'map.standardView'
  | 'map.releaseToSelect'
  | 'map.outsideZoneShort'
  | 'map.movePinRequired'
  | 'map.selectionHelp'
  | 'map.permissionDenied'
  | 'map.iosLocationRequestFailed'
  | 'map.positionUnavailable'
  | 'map.locationUnsupported'
  | 'map.locationTimeout'
  | 'map.confirmGpsPin'
  | 'map.loadFailedTitle'
  | 'map.loadFailedBody'
  | 'map.configurationMissingTitle'
  | 'map.configurationMissingBody'
  | 'map.offlineTitle'
  | 'map.offlineBody'
  | 'map.customerMarker'
  | 'map.driverMarker'
  | 'map.coverageTitle'
  | 'map.coverageFilter'
  | 'map.coverageAll'
  | 'map.coverageDestinations'
  | 'map.coverageRestaurants'
  | 'map.coverageAnalyzing'
  | 'map.coverageEmpty'
  | 'map.coverageSummary'
  | 'map.coverageLoadFailed'
  | 'map.gpsLive'
  | 'map.gpsIdle'
  | 'map.gpsError'
  | 'map.recenter'
  | 'map.weakConnection'
  | 'map.tilesSlow'
  | 'map.gpsWeakMeasured'
  | 'map.gpsWeakAction'
  | 'map.retryGps'
  | 'map.enterManually'
  | 'map.outsideBy'
  | 'map.findAvailableRestaurants'
  | 'map.zoomIn'
  | 'map.zoomOut'
  | 'map.accuracy.excellent'
  | 'map.accuracy.good'
  | 'map.accuracy.acceptable'
  | 'map.accuracy.weak'
  | 'map.accuracy.unknown'
  | 'location.deliverTo'
  | 'location.chooseExact'
  | 'location.title'
  | 'location.privacy'
  | 'location.saved'
  | 'location.noSaved'
  | 'location.privacyShort'
  | 'location.landmark'
  | 'location.instructions'
  | 'location.webAccuracyNotice'
  | 'location.dismissAccuracyNotice'
  | 'location.notConfirmed'
  | 'location.ready'
  | 'location.confirmOnMap'
  | 'location.confirmDelivery'
  | 'location.customLabel'
  | 'location.quoteSummary'
  | 'location.etaMinutes'
  | 'location.useSaved'
  | 'location.defaultAddress'
  | 'location.differentLocation'
  | 'location.recent'
  | 'location.recentNeedsConfirmation'
  | 'location.confirmedSuccess'
  | 'location.restaurantsDeliverHere'
  | 'location.restaurantDeliversHere'
  | 'location.etaRange'
  | 'location.minutesShort'
  | 'location.savePrompt'
  | 'location.saveAsHome'
  | 'location.saveAsWork'
  | 'location.notNow'
  // cart + checkout
  | 'cart.title'
  | 'cart.empty'
  | 'cart.emptyBody'
  | 'cart.subtotal'
  | 'cart.deliveryFee'
  | 'cart.serviceFee'
  | 'cart.total'
  | 'cart.checkout'
  | 'cart.removeItem'
  | 'cart.clear'
  | 'cart.switchWarning'
  | 'checkout.step.cart'
  | 'checkout.step.details'
  | 'checkout.step.confirm'
  | 'checkout.fullName'
  | 'checkout.phone'
  | 'checkout.contactQuestion'
  | 'checkout.useAccountPhone'
  | 'checkout.useDifferentPhone'
  | 'checkout.accountPhoneMissing'
  | 'checkout.alternatePhoneLabel'
  | 'checkout.address'
  | 'checkout.notes'
  | 'checkout.notesPlaceholder'
  | 'checkout.placeOrder'
  | 'checkout.placing'
  | 'checkout.delivery'
  | 'checkout.placeOrderSummary'
  | 'checkout.success'
  | 'checkout.successBody'
  | 'checkout.deliveryByRestaurant'
  | 'checkout.viewOrders'
  | 'checkout.backToCart'
  | 'checkout.backToDetails'
  | 'checkout.idle'
  | 'checkout.empty'
  | 'checkout.noRestaurant'
  | 'checkout.error'
  | 'checkout.errorCalc'
  | 'checkout.deliveryPlaceholder'
  | 'checkout.invalidPhone'
  | 'checkout.invalidAddress'
  | 'orders.title'
  | 'orders.id'
  | 'orders.items' 
  | 'orders.status'
  | 'orders.empty'
  | 'orders.total'
  | 'orders.placed'
  | 'orders.track'
  | 'orders.reorder'
  // status labels
  | 'status.pending'
  | 'status.accepted'
  | 'status.preparing'
  | 'status.out_for_delivery'
  | 'status.delivered'
  | 'status.cancelled'
  | 'status.accept'
  | 'status.reject'
  | 'status.startPreparing'
  | 'status.markOutForDelivery'
  | 'status.markDelivered'
  | 'status.cancelOrder'
  | 'status.failed_delivery'
  | 'status.markFailedDelivery'
  | 'status.refunded'
  | 'admin.restaurantsManagement'
  | 'admin.approve'
  | 'admin.reject'
  | 'admin.pendingApproval'
  | 'admin.noPending'
  // wilaya
  | 'wilaya.select'
  | 'wilaya.searchPlaceholder'
  | 'wilaya.detectLocation'
  | 'wilaya.detecting'
  | 'wilaya.noResults'
  | 'wilaya.detectError'
  | 'wilaya.permissionDenied'
  | 'wilaya.locationTooWeak'
  // navigation, maintenance, roles and admin details
  | 'nav.controlCenter'
  | 'nav.driverDashboard'
  | 'nav.support'
  | 'role.super_admin'
  | 'role.restaurant_owner'
  | 'role.customer'
  | 'role.driver'
  | 'sys.underMaintenance'
  | 'sys.maintenanceDesc'
  | 'admin.controlCenter'
  | 'admin.fullVisibility'
  | 'admin.financialsDesc'
  // support
  | 'support.title'
  | 'support.subtitle'
  | 'support.newTicket'
  | 'support.noTickets'
  | 'support.needHelp'
  | 'support.prioritySuffix'
  | 'support.form.subject'
  | 'support.form.subjectPlaceholder'
  | 'support.form.category'
  | 'support.form.priority'
  | 'support.form.orderIdOptional'
  | 'support.form.orderIdPlaceholder'
  | 'support.form.description'
  | 'support.form.descriptionPlaceholder'
  | 'support.form.submit'
  | 'support.form.validation'
  | 'support.backToTickets'
  | 'support.conversation'
  | 'support.noMessages'
  | 'support.typeReply'
  | 'support.category.general'
  | 'support.category.bug'
  | 'support.category.abuse'
  | 'support.category.complaint'
  | 'support.category.billing'
  | 'support.category.other'
  | 'support.priority.low'
  | 'support.priority.normal'
  | 'support.priority.high'
  | 'support.priority.urgent'
  | 'support.you'
  | 'support.staff'
  // profile & privacy
  | 'profile.loyalty.title'
  | 'profile.loyalty.subtitle'
  | 'profile.loyalty.currentPoints'
  | 'profile.loyalty.lifetimePoints'
  | 'profile.loyalty.nextTier'
  | 'profile.loyalty.maxTier'
  | 'profile.phone'
  | 'profile.language'
  | 'profile.addresses.title'
  | 'profile.addresses.addNew'
  | 'profile.addresses.label'
  | 'profile.addresses.home'
  | 'profile.addresses.work'
  | 'profile.addresses.family'
  | 'profile.addresses.other'
  | 'profile.addresses.default'
  | 'profile.addresses.setAsDefault'
  | 'profile.addresses.favorite'
  | 'profile.addresses.duplicate'
  | 'profile.addresses.archive'
  | 'profile.addresses.delete'
  | 'profile.addresses.none'
  | 'profile.addresses.signinToManage'
  | 'profile.addresses.save'
  | 'profile.privacy.title'
  | 'profile.privacy.subtitle'
  | 'profile.privacy.export'
  | 'profile.privacy.exportDesc'
  | 'profile.privacy.delete'
  | 'profile.privacy.deleteDesc'
  | 'profile.privacy.exportSuccess'
  | 'profile.privacy.exportFailed'
  | 'profile.privacy.policy'
  | 'profile.privacy.cookie'
  | 'profile.privacy.refund'
  // deletion modal
  | 'profile.deleteModal.title'
  | 'profile.deleteModal.body1'
  | 'profile.deleteModal.body2'
  | 'profile.deleteModal.warn'
  | 'profile.deleteModal.confirmText'
  | 'profile.deleteModal.deleteForever'
  | 'profile.deleteModal.deleting'
  // driver dashboard & onboarding
  | 'driver.dashboard'
  | 'driver.activeDelivery'
  | 'driver.waitingRequests'
  | 'driver.goOnlineDesc'
  | 'driver.onboarding.title'
  | 'driver.onboarding.subtitle'
  | 'driver.onboarding.successTitle'
  | 'driver.onboarding.successBody'
  | 'driver.onboarding.redirecting'
  | 'driver.onboarding.step1Title'
  | 'driver.onboarding.step2Title'
  | 'driver.onboarding.step3Title'
  | 'driver.onboarding.licensePlate'
  | 'driver.onboarding.licenseNumber'
  | 'driver.onboarding.idNumber'
  | 'driver.onboarding.uploadDocs'
  | 'driver.onboarding.uploadPrompt'
  | 'driver.onboarding.uploadFormat'
  | 'driver.onboarding.phonePrompt'
  | 'driver.onboarding.appSummary'
  // reset password
  | 'auth.resetPasswordSuccess'
  | 'auth.resetPasswordSuccessBody'
  | 'auth.newPassword'
  | 'auth.newPasswordPrompt'
  | 'auth.updating'
  | 'auth.savePassword'
  // restaurant settings
  | 'restaurant.settings.title'
  | 'restaurant.settings.businessHours'
  | 'restaurant.settings.hoursDesc'
  | 'restaurant.settings.deliveryConfig'
  | 'restaurant.settings.maxRadius'
  | 'restaurant.settings.maxRadiusDesc'
  | 'restaurant.settings.minOrder'
  | 'restaurant.settings.minOrderDesc'
  | 'restaurant.settings.estTime'
  | 'restaurant.settings.estTimeDesc'
  | 'restaurant.settings.opStatus'
  | 'restaurant.settings.opStatusDesc'
  | 'restaurant.settings.saving'
  | 'restaurant.settings.saveSettings'
  | 'restaurant.settings.saved'
  | 'restaurant.settings.commissionRate'
  | 'restaurant.settings.commissionDesc'
  | 'restaurant.settings.invalidCommissionRate'
  | 'restaurant.settings.financialTitle'
  | 'restaurant.dash.today'
  | 'restaurant.dash.thisMonth'
  | 'restaurant.dash.commissionOwed'
  | 'restaurant.dash.netPayout'
  | 'restaurant.dash.soundOn'
  | 'restaurant.dash.soundOff'
  | 'restaurant.dash.activeOrders'
  | 'restaurant.dash.completed'
  | 'restaurant.dash.newOrderAlert'
  | 'favorites.subtitle'
  | 'favorites.none'
  | 'orders.reviewed'
  | 'orders.leaveReview'
  | 'driver.onboard.title'
  | 'driver.onboard.subtitle'
  | 'driver.onboard.success.title'
  | 'driver.onboard.success.body'
  | 'driver.onboard.success.redirect'
  | 'driver.onboard.step.vehicle'
  | 'driver.onboard.step.details'
  | 'driver.onboard.licensePlate'
  | 'driver.onboard.licenseNumber'
  | 'driver.onboard.idNumber'
  | 'driver.onboard.uploadDocuments'
  | 'driver.onboard.uploadPrompt'
  | 'driver.onboard.uploadFormat'
  | 'driver.onboard.contactTitle'
  | 'driver.onboard.phone'
  | 'driver.onboard.phoneHelp'
  | 'driver.onboard.summary'
  | 'driver.onboard.vehicle'
  | 'driver.onboard.plate'
  | 'driver.onboard.license'
  | 'driver.onboard.id'
  | 'driver.onboard.documents'
  | 'driver.onboard.submit'
  | 'driver.vehicle.bicycle'
  | 'driver.vehicle.bicycle.desc'
  | 'driver.vehicle.motorcycle'
  | 'driver.vehicle.motorcycle.desc'
  | 'driver.vehicle.scooter'
  | 'driver.vehicle.scooter.desc'
  | 'driver.vehicle.car'
  | 'driver.vehicle.car.desc'
  | 'common.continue'
  | 'common.to'
  | 'common.closed'
  | 'day.0'
  | 'day.1'
  | 'day.2'
  | 'day.3'
  | 'day.4'
  | 'day.5'
  | 'day.6'
  | 'driver.dash.pendingVerification'
  | 'driver.dash.failedLoad'
  | 'driver.dash.onlineAccepting'
  | 'driver.dash.offline'
  | 'driver.dash.goOnline'
  | 'driver.dash.online'
  | 'driver.dash.today'
  | 'driver.dash.thisWeek'
  | 'driver.dash.pending'
  | 'driver.dash.deliveries'
  | 'driver.dash.headingToRestaurant'
  | 'driver.dash.orderCollected'
  | 'driver.dash.enRouteToCustomer'
  | 'driver.dash.arrived'
  | 'driver.dash.markAsDelivered'
  | 'driver.dash.newRequest'
  | 'driver.dash.pickup'
  | 'driver.dash.deliverTo'
  | 'driver.dash.accept'
  | 'driver.dash.decline'
  | 'driver.dash.title'
  | 'driver.dash.activeDelivery'
  | 'driver.dash.waiting'
  | 'driver.dash.goOnlineHelp';

type Dict = Record<TranslationKey, string>;

const en: Dict = {
  'brand.name': 'Kiyo Food',
  'brand.tagline': 'Local flavor, delivered.',
  'brand.heroSubtitle': 'Order from the best restaurants across Algeria with Kiyo Food. Fast delivery, transparent prices, cash on delivery.',
  'brand.heroFeature1Title': 'Fast delivery',
  'brand.heroFeature1Desc': 'Your favorite dishes delivered hot and fresh, anywhere in your city.',
  'brand.heroFeature2Title': 'Verified restaurants',
  'brand.heroFeature2Desc': 'All our partners are selected and verified for quality.',
  'brand.heroFeature3Title': 'Transparent prices',
  'brand.heroFeature3Desc': 'No hidden fees. You see exactly what you pay.',
  'brand.heroFeature4Title': 'Cash on delivery',
  'brand.heroFeature4Desc': 'Pay in cash when you receive your order.',
  'brand.heroFeature5Title': 'Local marketplace',
  'brand.heroFeature5Desc': 'A platform designed for Algeria, by and for Algerians.',
  'brand.heroFeature6Title': 'Easy ordering',
  'brand.heroFeature6Desc': 'A few taps and your meal is on its way. Simple, fast, reliable.',
  'brand.whyKiyo': 'Why choose Kiyo Food?',
  'brand.seoDescription': 'Algerian food delivery marketplace. Fast delivery, transparent prices, cash on delivery.',
  'brand.areaServed': 'Algeria',
  'auth.login': 'Sign in',
  'auth.signup': 'Create account',
  'auth.logout': 'Sign out',
  'auth.email': 'Email address',
  'auth.phone': 'Phone number',
  'auth.password': 'Password',
  'auth.confirmPassword': 'Confirm password',
  'auth.fullName': 'Full name',
  'auth.forgotPassword': 'Forgot password?',
  'auth.resetPassword': 'Reset password',
  'auth.resetPasswordCta': 'Send reset link',
  'auth.continueWithGoogle': 'Continue with Google',
  'auth.continueWithApple': 'Continue with Apple',
  'auth.orContinueWith': 'or',
  'auth.noAccount': "Don't have an account?",
  'auth.haveAccount': 'Already have an account?',
  'auth.chooseRole': 'I want to',
  'auth.role.customer': 'Order food',
  'auth.role.restaurant': 'Sell on Kiyo Food',
  'auth.acceptTerms': 'I agree to the',
  'auth.termsLink': 'Terms of Use',
  'auth.privacyLink': 'Privacy Policy',
  'auth.createAccount': 'Create account',
  'auth.signingIn': 'Signing in…',
  'auth.signingUp': 'Creating account…',
  'auth.sendingReset': 'Sending link…',
  'auth.backToLogin': 'Back to sign in',
  'auth.checkEmailReset': 'Check your inbox for a password reset link.',
  'auth.sessionRestoring': 'Restoring your session…',
  'auth.error.invalidCredentials': 'Email or password is incorrect.',
  'auth.error.emailTaken': 'An account with this email already exists.',
  'auth.error.weakPassword': 'Password must be at least 8 characters.',
  'auth.error.tooManyAttempts': 'Too many attempts. Please wait a moment and try again.',
  'auth.error.network': 'Network problem. Check your connection and try again.',
  'auth.error.timeout': 'This is taking longer than expected. Please retry.',
  'auth.error.unknown': 'Something went wrong. Please try again.',
  'auth.error.passwordMismatch': 'Passwords do not match.',
  'auth.error.acceptTerms': 'Please accept the Terms and Privacy Policy.',
  'auth.error.invalidEmail': 'Please enter a valid email address.',
  'auth.error.invalidPhone': 'Enter a valid Algerian mobile number starting with 05, 06, 07, or +213.',
  'auth.error.emailDelivery': 'Kiyo Food could not send the reset email. Email delivery is temporarily unavailable; please try again later or contact support.',
  'auth.error.emailNotConfirmed': 'Confirm your email before signing in. Check your inbox for the Kiyo Food confirmation email.',
  'auth.error.popupBlocked': 'Allow popups for Kiyo Food to continue with this login provider.',
  'auth.error.providerNotEnabled': 'This sign-in provider is not enabled yet. Ask the administrator to enable it in Supabase → Authentication → Providers.',
  'auth.error.invalidRedirect': 'The sign-in provider rejected the redirect. The administrator must add the Supabase callback URL to the provider console (see Setup Guide).',
  'auth.signupCheckEmailTitle': 'Confirm your email',
  'auth.signupCheckEmailBody': 'Your account was created. Open the confirmation email from Kiyo Food, then come back and sign in.',
  'auth.resetInvalidTitle': 'Reset link expired',
  'auth.resetInvalidBody': 'Request a new password reset link. For security, reset links can expire or be used only once.',
  'auth.restaurantAccessTitle': 'Restaurant accounts are verified after signup.',
  'auth.restaurantAccessBody': 'Create a customer account first. Restaurant owner access is granted through onboarding and admin approval, so public signup cannot be abused to choose a staff role.',
  'nav.home': 'Home',
  'nav.dashboard': 'Dashboard',
  'nav.favorites': 'Favorites',
  'nav.profile': 'Profile',
  'nav.settings': 'Settings',
  'nav.auditLogs': 'Audit logs',
  'nav.users': 'Users',
  'nav.restaurants': 'Restaurants',
  'nav.orders': 'Orders',
  'dash.welcome': 'Welcome back',
  'dash.role': 'Your role',
  'dash.customer.title': 'Your account',
  'dash.customer.subtitle': 'Hungry? Browse restaurants near you.',
  'dash.restaurant.title': 'Restaurant dashboard',
  'dash.restaurant.subtitle': 'Manage your menu and incoming orders.',
  'dash.admin.title': 'Platform control',
  'dash.admin.subtitle': 'Full visibility across Kiyo Food operations.',
  'dash.comingSoon': 'This area will be built in the next phase.',
  'dash.accountInfo': 'Account information',
  'dash.totalOrders': 'Total orders',
  'dash.totalRestaurants': 'Restaurants',
  'dash.totalUsers': 'Users',
  'dash.recentActivity': 'Recent activity',
  'error.genericTitle': 'Something broke',
  'error.genericBody': 'An unexpected error occurred. You can retry or reload the page.',
  'error.retry': 'Try again',
  'error.reload': 'Reload page',
  'error.pageNotFound': 'Page not found',
  'error.pageNotFoundBody': 'The page you are looking for does not exist or was moved.',
  'error.goHome': 'Go to home',
  'error.unauthorizedTitle': 'Please sign in',
  'error.unauthorizedBody': 'You need to be signed in to view this page.',
  'error.forbiddenTitle': 'Access denied',
  'error.forbiddenBody': "You don't have permission to view this page.",
  'common.loading': 'Loading…',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.edit': 'Edit',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.search': 'Search',
  'common.none': '—',
  'common.refunds': 'Refunds',
  'common.cookies': 'Cookies',
  'audit.title': 'Audit log',
  'audit.actor': 'Actor',
  'audit.action': 'Action',
  'audit.target': 'Target',
  'audit.time': 'Time',
  'audit.empty': 'No activity recorded yet.',
  'market.browse': 'Browse restaurants',
  'market.openNow': 'Open now',
  'market.freeDelivery': 'Free delivery',
  'market.topRated': 'Top rated',
  'market.empty': 'No restaurants found near you yet.',
  'market.searchPlaceholder': 'Search restaurants or cuisines…',
  'market.nearMe': 'Near me',
  'market.locationTooWeak': 'Your location is not accurate enough to sort restaurants safely. Try again in an open area.',
  'restaurant.menu': 'Menu',
  'restaurant.owner': 'Owner',
  'restaurant.addToCart': 'Add to cart',
  'restaurant.closed': 'Closed',
  'restaurant.open': 'Open',
  'restaurant.busy': 'Busy',
  'restaurant.reviews': 'reviews',
  'restaurant.about': 'About',
  'restaurant.noMenu': 'Menu not published yet.',
  'restaurant.addCategory': 'Add category',
  'restaurant.addItem': 'Add item',
  'restaurant.editItem': 'Edit item',
  'restaurant.newItem': 'New item',
  'restaurant.onboard': 'Open your restaurant',
  'restaurant.onboard.prompt': 'List your restaurant on Kiyo Food in minutes.',
  'restaurant.onboard.existingOwnerHelp': '(existing restaurant owner)',
  'restaurant.onboard.noOwners': 'No restaurant-owner accounts exist yet. Have the owner sign up first (they will choose "Sell on Kiyo" on the signup form), then return here to create their restaurant.',
  'restaurant.onboard.invalidName': 'Restaurant name must contain at least 2 characters.',
  'restaurant.onboard.ownerRequired': 'Select a verified restaurant owner before creating a restaurant.',
  'restaurant.onboard.locationTitle': 'Restaurant location',
  'restaurant.onboard.locationHelp': 'Use GPS or place the pin exactly on the restaurant entrance before publishing.',
  'restaurant.onboard.coordinatesSaved': 'Coordinates saved',
  'restaurant.onboard.pendingNotice': 'Created as pending_approval. Review and publish from the admin restaurants page.',
  'restaurant.phone': 'Phone',
  'restaurant.address': 'Address',
  'restaurant.cuisine': 'Cuisine (comma-separated)',
  'restaurant.image': 'Image URL',
  'restaurant.create': 'Create restaurant',
  'restaurant.creating': 'Creating…',
  'restaurant.openRestaurant': 'Open a restaurant',
  'restaurant.available': 'Available',
  'restaurant.outOfStock': 'Out of stock',
  'restaurant.price': 'Price (DZD)',
  'restaurant.categoryName': 'Category name',
  'restaurant.itemName': 'Item name',
  'restaurant.description': 'Description',
  'restaurant.delete': 'Delete',
  'restaurant.dashboard': 'Restaurant dashboard',
  'restaurant.manageMenu': 'Manage menu',
  'restaurant.waitingOrders': 'Incoming orders',
  'restaurant.noOrders': 'No new orders right now.',
  'restaurant.apply.nav': 'Apply as restaurant',
  'restaurant.apply.title': 'Restaurant application',
  'restaurant.apply.subtitle': 'Submit your restaurant for owner review. It stays pending until Kiyo Food approves it.',
  'restaurant.apply.name': 'Restaurant name',
  'restaurant.apply.legalName': 'Legal business name',
  'restaurant.apply.openingHours': 'Opening hours',
  'restaurant.apply.openingHoursPlaceholder': 'Example: Sunday to Thursday 11:00-23:00, Friday 15:00-23:30',
  'restaurant.apply.logo': 'Restaurant logo',
  'restaurant.apply.cover': 'Restaurant cover image',
  'restaurant.apply.submit': 'Submit application',
  'restaurant.apply.submitting': 'Submitting...',
  'restaurant.apply.successTitle': 'Application submitted',
  'restaurant.apply.successBody': 'Your restaurant is now pending review. Kiyo Food will approve it or send a clear rejection reason so you can edit and resubmit.',
  'restaurant.apply.errorName': 'Enter a valid restaurant name.',
  'restaurant.apply.errorPhone': 'Enter a valid restaurant phone number.',
  'restaurant.apply.errorAddress': 'Enter a valid restaurant address.',
  'restaurant.apply.errorLocation': 'Pin the restaurant location on the map.',
  'restaurant.apply.errorDelivery': 'Enter a delivery radius between 1 and 100 km.',
  'restaurant.apply.errorMinOrder': 'Minimum order amount cannot be negative.',
  'map.searchPlaceholder': 'Search address, neighborhood, city...',
  'map.useCurrentLocation': 'Use current location',
  'map.locating': 'Locating...',
  'map.gps': 'GPS',
  'map.searching': 'Searching addresses...',
  'map.loading': 'Loading map...',
  'map.locationUnavailable': 'Location is unavailable. You can still search or tap the map to pick a delivery point.',
  'map.locationOutsideAlgeria': 'This location is outside Algeria. Please search or place the pin inside the service area.',
  'map.gpsWeak': 'GPS accuracy is weak. The pin was placed, but please confirm or drag it to the exact entrance.',
  'map.gpsApproximate': 'GPS accuracy is approximate. The pin was placed, but drag it to the exact entrance before submitting.',
  'map.improvingAccuracy': 'Improving GPS accuracy...',
  'map.restaurantConfirmRequired': 'Restaurant GPS must be exact. Drag the pin to the entrance and confirm it.',
  'map.confirmWeakGps': 'GPS is still weak. Drag the pin to the exact entrance and confirm it before saving.',
  'map.confirmDraggedPin': 'Confirm this exact pin before saving.',
  'map.confirmSearchPin': 'Search found this area. Move the pin if needed, then confirm the exact location.',
  'map.pinConfirmed': 'Pin confirmed',
  'map.pinNeedsConfirmation': 'Pin needs confirmation',
  'map.confirmPin': 'Confirm exact pin',
  'map.confirmRequired': 'Confirm the exact map pin before continuing.',
  'map.tileFallbackActive': 'Map fallback is active because the primary tiles were slow.',
  'map.tileReconnecting': 'Map tiles are reconnecting. Your selected pin remains safe.',
  'map.distance': 'Distance',
  'map.max': 'max',
  'map.gpsAccuracy': 'GPS accuracy',
  'map.heading': 'heading',
  'map.outsideZone': "This address is outside the restaurant's delivery zone",
  'map.locationDeliveryZone': 'Location & delivery zone',
  'map.locationUnavailableShort': 'Location unavailable for this restaurant.',
  'map.trackingRiderEnRoute': 'Rider en route',
  'map.trackingPreparing': 'Preparing order',
  'map.trackingLive': 'Order live',
  'map.driverWeakGps': 'GPS accuracy is weak. Move near a window or open area.',
  'map.driverJump': 'Location jump detected. Keep GPS enabled for reliable dispatch.',
  'map.driverSyncFailed': 'Live GPS could not sync. Keep this page open and check location permission.',
  'map.driverPermissionRequired': 'Location permission is required while online.',
  'map.searchUnavailable': 'Address search is temporarily unavailable. You can still move the map to choose the exact point.',
  'map.addressStillLoading': 'Address services are still loading. Wait a moment and try again.',
  'map.addressNotFound': 'No precise street address was found here. Move the map to the exact entrance and confirm the pin.',
  'map.addressApproximate': 'This result identifies an area, not an exact entrance. Move the map to the correct point before confirming.',
  'map.locationSelector': 'Choose an exact location',
  'map.restaurantMarker': 'Restaurant location',
  'map.currentPosition': 'Current GPS position',
  'map.satelliteView': 'Switch to satellite view',
  'map.standardView': 'Switch to standard map',
  'map.releaseToSelect': 'Release the map to select this point',
  'map.outsideZoneShort': 'Outside delivery zone',
  'map.movePinRequired': 'Move the map to the exact point',
  'map.selectionHelp': 'Search for an address, use your current location, or move the map to the exact entrance.',
  'map.permissionDenied': 'The location request was not authorized. Check both this site’s permission and your device Location Services, then retry or enter the address manually.',
  'map.iosLocationRequestFailed': 'Safari could not authorize this location request. In iPhone Settings, check Privacy & Security → Location Services → Safari Websites and enable Precise Location, then retry or enter the address manually.',
  'map.positionUnavailable': 'Location permission may be enabled, but the device could not determine a position. Turn on Location Services, move to an open area, then retry or enter the address manually.',
  'map.locationUnsupported': 'This browser does not provide location. Search for the address or choose the point manually.',
  'map.locationTimeout': 'GPS took too long to respond. Move to an open area and retry, or choose the point manually.',
  'map.confirmGpsPin': 'GPS found this point. Verify the entrance on the map, then confirm the pin.',
  'map.loadFailedTitle': 'The map could not load',
  'map.loadFailedBody': 'Check your connection and retry. Your form data has not been lost.',
  'map.configurationMissingTitle': 'Map service is unavailable',
  'map.configurationMissingBody': 'Location selection is temporarily unavailable. Please try again shortly.',
  'map.customerMarker': 'Delivery location',
  'map.driverMarker': 'Driver location',
  'map.coverageTitle': 'Delivery activity map',
  'map.coverageFilter': 'Filter map activity',
  'map.coverageAll': 'All activity',
  'map.coverageDestinations': 'Destinations',
  'map.coverageRestaurants': 'Restaurants',
  'map.coverageAnalyzing': 'Analyzing location activity...',
  'map.coverageEmpty': 'No verified location data matches this filter yet.',
  'map.coverageSummary': 'verified location points displayed for operational coverage planning.',
  'map.coverageLoadFailed': 'Location activity could not be loaded. Verify owner access and try again.',
  'map.gpsLive': 'live',
  'map.gpsIdle': 'idle',
  'map.gpsError': 'unavailable',
  'map.offlineTitle': 'You are offline',
  'map.offlineBody': 'Reconnect to load the interactive map. Your selected address and form details are still saved.',
  'map.recenter': 'Recenter on my location',
  'map.weakConnection': 'Weak connection — map features may take a little longer.',
  'map.tilesSlow': 'The map is loading on a slow connection. Your last location is ready while we keep trying.',
  'map.gpsWeakMeasured': 'GPS could only locate you to approximately',
  'map.gpsWeakAction': 'Try again in an open area or enter the address manually; this reading was not selected.',
  'map.retryGps': 'Try GPS again',
  'map.enterManually': 'Enter address manually',
  'map.outsideBy': 'outside this delivery area',
  'map.findAvailableRestaurants': 'See restaurants that deliver here',
  'map.zoomIn': 'Zoom in',
  'map.zoomOut': 'Zoom out',
  'map.accuracy.excellent': 'Excellent',
  'map.accuracy.good': 'Good',
  'map.accuracy.acceptable': 'Confirm carefully',
  'map.accuracy.weak': 'Weak',
  'map.accuracy.unknown': 'Unknown',
  'location.deliverTo': 'Deliver to',
  'location.chooseExact': 'Choose an exact location',
  'location.title': 'Where should we deliver?',
  'location.privacy': 'Search, use GPS, then confirm the exact entrance on the map.',
  'location.saved': 'Saved and recent',
  'location.noSaved': 'No saved addresses yet. Choose an exact point on the map.',
  'location.privacyShort': 'Your precise location is used only to find serviceable restaurants and deliver your order.',
  'location.landmark': 'Nearby landmark',
  'location.instructions': 'Instructions for the driver',
  'location.webAccuracyNotice': 'For best accuracy, search for your address or place the pin manually instead of relying only on GPS. Our upcoming mobile app will offer significantly more precise location detection.',
  'location.dismissAccuracyNotice': 'Dismiss location accuracy information',
  'location.notConfirmed': 'No exact delivery point confirmed',
  'location.ready': 'Exact coordinates are ready for delivery.',
  'location.confirmOnMap': 'Confirm the pin on the map before continuing.',
  'location.confirmDelivery': 'Confirm delivery location',
  'location.customLabel': 'Address name (optional)',
  'location.quoteSummary': 'Verified delivery distance',
  'location.etaMinutes': 'Estimated arrival (minutes)',
  'location.useSaved': 'Use a saved address',
  'location.defaultAddress': 'Default',
  'location.differentLocation': 'Deliver to a different location',
  'location.recent': 'Recent location',
  'location.recentNeedsConfirmation': 'Review this recent point on the map before confirming it.',
  'location.confirmedSuccess': 'Location confirmed',
  'location.restaurantsDeliverHere': 'restaurants deliver to this location',
  'location.restaurantDeliversHere': 'restaurant delivers to this location',
  'location.etaRange': 'Estimated delivery',
  'location.minutesShort': 'min',
  'location.savePrompt': 'Save this address as Home or Work for faster checkout next time?',
  'location.saveAsHome': 'Save as Home',
  'location.saveAsWork': 'Save as Work',
  'location.notNow': 'Not now',
  'cart.title': 'Your cart',
  'cart.empty': 'Your cart is empty',
  'cart.emptyBody': 'Browse restaurants and add items to get started.',
  'cart.subtotal': 'Subtotal',
  'cart.deliveryFee': 'Delivery fee',
  'cart.serviceFee': 'Service fee',
  'cart.total': 'Total',
  'cart.checkout': 'Checkout',
  'cart.removeItem': 'Remove',
  'cart.clear': 'Clear cart',
  'cart.switchWarning': 'Adding items from a different restaurant will replace your current cart.',
  'checkout.step.cart': 'Cart',
  'checkout.step.details': 'Delivery details',
  'checkout.step.confirm': 'Confirm order',
  'checkout.fullName': 'Full name',
  'checkout.phone': 'Phone number',
  'checkout.contactQuestion': 'Which phone number should the restaurant or driver use for this order?',
  'checkout.useAccountPhone': 'Use my account phone number',
  'checkout.useDifferentPhone': 'Use a different number for this order',
  'checkout.accountPhoneMissing': 'No phone number saved on this account',
  'checkout.alternatePhoneLabel': 'Phone number for this order',
  'checkout.address': 'Delivery address',
  'checkout.notes': 'Order notes',
  'checkout.notesPlaceholder': 'e.g. no onions, extra spicy',
  'checkout.placeOrder': 'Place order',
  'checkout.placing': 'Placing order…',
  'checkout.delivery': 'Delivery',
  'checkout.placeOrderSummary': 'You will be charged a fixed fee, calculated by Kiyo Food based on delivery distance.',
  'checkout.success': 'Order placed!',
  'checkout.successBody': 'Your order has been sent to the restaurant.',
  'checkout.deliveryByRestaurant': 'Delivery is managed directly by the restaurant.',
  'checkout.viewOrders': 'View my orders',
  'checkout.backToCart': 'Back to cart',
  'checkout.backToDetails': 'Back to details',
  'checkout.idle': 'Ready to place order',
  'checkout.empty': 'Your cart is empty.',
  'checkout.noRestaurant': 'No restaurant selected.',
  'checkout.error': 'Could not place the order. Please try again.',
  'checkout.errorCalc': 'Could not calculate delivery fee. Please retry.',
  'checkout.deliveryPlaceholder': 'Street, building, floor…',
  'checkout.invalidPhone': 'Enter a valid phone number.',
  'checkout.invalidAddress': 'Enter a delivery address.',
  'orders.title': 'Your orders',
  'orders.id': 'Order',
  'orders.items': 'items',
  'orders.status': 'Status',
  'orders.empty': 'You have no orders yet.',
  'orders.total': 'Total',
  'orders.placed': 'Placed',
  'orders.track': 'Track',
  'orders.reorder': 'Reorder',
  'status.pending': 'Pending',
  'status.accepted': 'Accepted',
  'status.preparing': 'Preparing',
  'status.out_for_delivery': 'Out for delivery',
  'status.delivered': 'Delivered',
  'status.cancelled': 'Cancelled',
  'status.accept': 'Accept',
  'status.reject': 'Reject',
  'status.startPreparing': 'Start preparing',
  'status.markOutForDelivery': 'Out for delivery',
  'status.markDelivered': 'Mark delivered',
  'status.cancelOrder': 'Cancel order',
  'status.failed_delivery': 'Failed delivery',
  'status.markFailedDelivery': 'Mark failed',
  'status.refunded': 'Refunded',
  'admin.restaurantsManagement': 'Restaurants',
  'admin.approve': 'Approve',
  'admin.reject': 'Reject',
  'admin.pendingApproval': 'Pending approval',
  'admin.noPending': 'No restaurants awaiting approval.',
  'wilaya.select': 'Select wilaya',
  'wilaya.searchPlaceholder': 'Search wilayas…',
  'wilaya.detectLocation': 'Detect my location',
  'wilaya.detecting': 'Detecting…',
  'wilaya.noResults': 'No wilayas found.',
  'wilaya.detectError': 'Your wilaya could not be determined reliably. Please select it manually.',
  'wilaya.permissionDenied': 'Location access is blocked. Allow it in your browser settings or select your wilaya manually.',
  'wilaya.locationTooWeak': 'Your location is not accurate enough to choose a wilaya safely. Please select it manually.',
  'nav.controlCenter': 'Control Center',
  'nav.driverDashboard': 'Driver Dashboard',
  'nav.support': 'Support',
  'role.super_admin': 'Super Admin',
  'role.restaurant_owner': 'Restaurant Owner',
  'role.customer': 'Customer',
  'role.driver': 'Driver',
  'sys.underMaintenance': 'Under Maintenance',
  'sys.maintenanceDesc': 'We are performing scheduled maintenance. Please check back shortly.',
  'admin.controlCenter': 'Control Center',
  'admin.fullVisibility': 'Full platform visibility & management',
  'admin.financialsDesc': 'Financials, users, restaurants, rules, analytics',
  // support
  'support.title': 'Support',
  'support.subtitle': 'Get help with orders, payments, or account issues',
  'support.newTicket': 'New Ticket',
  'support.noTickets': 'No support tickets yet',
  'support.needHelp': 'Need help? Create a ticket above.',
  'support.prioritySuffix': 'priority',
  'support.form.subject': 'Subject',
  'support.form.subjectPlaceholder': 'Brief description of your issue',
  'support.form.category': 'Category',
  'support.form.priority': 'Priority',
  'support.form.orderIdOptional': 'Order ID (optional)',
  'support.form.orderIdPlaceholder': 'Paste order ID if related to a specific order',
  'support.form.description': 'Description',
  'support.form.descriptionPlaceholder': 'Describe your issue in detail...',
  'support.form.submit': 'Submit Ticket',
  'support.form.validation': 'Please fill in subject and description',
  'support.backToTickets': 'Back to tickets',
  'support.conversation': 'Conversation',
  'support.noMessages': 'No messages yet. Start the conversation below.',
  'support.typeReply': 'Type your reply...',
  'support.category.general': 'General',
  'support.category.bug': 'Bug / Technical',
  'support.category.abuse': 'Abuse / Report',
  'support.category.complaint': 'Complaint',
  'support.category.billing': 'Billing / Payment',
  'support.category.other': 'Other',
  'support.priority.low': 'Low',
  'support.priority.normal': 'Normal',
  'support.priority.high': 'High',
  'support.priority.urgent': 'Urgent',
  'support.you': 'You',
  'support.staff': 'Support',
  // profile & privacy
  'profile.loyalty.title': 'Loyalty Program',
  'profile.loyalty.subtitle': 'Earn 1 point for every 100 DZD spent',
  'profile.loyalty.currentPoints': 'Current Points',
  'profile.loyalty.lifetimePoints': 'Lifetime Points',
  'profile.loyalty.nextTier': 'Next Tier',
  'profile.loyalty.maxTier': 'Maximum tier reached!',
  'profile.phone': 'Phone',
  'profile.language': 'Language',
  'profile.addresses.title': 'Saved Addresses',
  'profile.addresses.addNew': 'Add New',
  'profile.addresses.label': 'Label',
  'profile.addresses.home': 'Home',
  'profile.addresses.work': 'Work',
  'profile.addresses.family': 'Family',
  'profile.addresses.other': 'Other',
  'profile.addresses.default': 'Default',
  'profile.addresses.setAsDefault': 'Set as default',
  'profile.addresses.favorite': 'Favorite',
  'profile.addresses.duplicate': 'Duplicate',
  'profile.addresses.archive': 'Archive',
  'profile.addresses.delete': 'Delete',
  'profile.addresses.none': 'No saved addresses yet. Add your home, work, or favorite delivery spots.',
  'profile.addresses.signinToManage': 'Sign in to manage your saved addresses.',
  'profile.addresses.save': 'Save Address',
  'profile.privacy.title': 'Privacy & Data',
  'profile.privacy.subtitle': 'Your data, your control. Export or delete your personal data in compliance with our Account Deletion Policy.',
  'profile.privacy.export': 'Export my data',
  'profile.privacy.exportDesc': 'Download as JSON',
  'profile.privacy.delete': 'Delete my account',
  'profile.privacy.deleteDesc': 'Permanent after 14 days',
  'profile.privacy.exportSuccess': 'Export downloaded.',
  'profile.privacy.exportFailed': 'Export failed. Please try again.',
  'profile.privacy.policy': 'Privacy Policy',
  'profile.privacy.cookie': 'Cookie Policy',
  'profile.privacy.refund': 'Refund & Cancellation',
  // deletion modal
  'profile.deleteModal.title': 'Delete account',
  'profile.deleteModal.body1': 'This will immediately sign you out and lock your account. Your profile, favorites, and saved data will be deleted within 14 days.',
  'profile.deleteModal.body2': 'Order and financial records are retained for 7 years as required by tax law — but they will be anonymized and no longer linked to your identity.',
  'profile.deleteModal.warn': 'Restaurant owner accounts with an active restaurant cannot self-delete. Contact support instead.',
  'profile.deleteModal.confirmText': 'Type DELETE to confirm',
  'profile.deleteModal.deleteForever': 'Delete forever',
  'profile.deleteModal.deleting': 'Deleting…',
  // driver dashboard & onboarding
  'driver.dashboard': 'Driver Dashboard',
  'driver.activeDelivery': 'Active Delivery',
  'driver.waitingRequests': 'Waiting for new delivery requests...',
  'driver.goOnlineDesc': 'Go online to start receiving deliveries',
  'driver.onboarding.title': 'Become a Driver',
  'driver.onboarding.subtitle': 'Complete your application to start earning with Kiyo Food',
  'driver.onboarding.successTitle': 'Application Submitted!',
  'driver.onboarding.successBody': 'Your driver application is being reviewed. You will be notified once approved.',
  'driver.onboarding.redirecting': 'Redirecting to dashboard...',
  'driver.onboarding.step1Title': 'Select Your Vehicle',
  'driver.onboarding.step2Title': 'Vehicle Details',
  'driver.onboarding.step3Title': 'Contact Information',
  'driver.onboarding.licensePlate': 'License Plate Number',
  'driver.onboarding.licenseNumber': "Driver's License Number",
  'driver.onboarding.idNumber': 'National ID Number',
  'driver.onboarding.uploadDocs': 'Upload Documents',
  'driver.onboarding.uploadPrompt': 'Upload license, ID, and vehicle registration',
  'driver.onboarding.uploadFormat': 'PNG, JPG, or PDF',
  'driver.onboarding.phonePrompt': "We'll use this number to contact you about deliveries",
  'driver.onboarding.appSummary': 'Application Summary',
  // reset password
  'auth.resetPasswordSuccess': 'Password reset successfully!',
  'auth.resetPasswordSuccessBody': 'Your password has been updated successfully.',
  'auth.newPassword': 'New Password',
  'auth.newPasswordPrompt': 'Enter your new password below.',
  'auth.updating': 'Updating...',
  'auth.savePassword': 'Save password',
  // restaurant settings
  'restaurant.settings.title': 'Restaurant Settings',
  'restaurant.settings.businessHours': 'Business Hours',
  'restaurant.settings.hoursDesc': 'Set your opening and closing times for each day. Leave a day unchecked to mark it as closed.',
  'restaurant.settings.deliveryConfig': 'Delivery Configuration',
  'restaurant.settings.maxRadius': 'Max Delivery Radius (km)',
  'restaurant.settings.maxRadiusDesc': 'Customers outside this radius cannot order from your restaurant.',
  'restaurant.settings.minOrder': 'Minimum Order Amount (DZD)',
  'restaurant.settings.minOrderDesc': 'Orders below this amount will be rejected.',
  'restaurant.settings.estTime': 'Estimated Delivery Time (minutes)',
  'restaurant.settings.estTimeDesc': 'This is shown to customers before they order.',
  'restaurant.settings.opStatus': 'Operational Status',
  'restaurant.settings.opStatusDesc': 'Open: Accepting orders normally. Busy: Extended preparation times. Closed: Not accepting orders.',
  'restaurant.settings.saving': 'Saving...',
  'restaurant.settings.saveSettings': 'Save Settings',
  'restaurant.settings.saved': 'Settings saved!',
  'restaurant.settings.commissionRate': 'Profit Margin / Commission Rate (%)',
  'restaurant.settings.commissionDesc': 'Set your restaurant commission percentage. This is stored directly inside your restaurant profile and used to calculate platform payout splits.',
  'restaurant.settings.invalidCommissionRate': 'Please enter a valid commission rate percentage between 0 and 100.',
  'restaurant.settings.financialTitle': 'Financial Settings',
  'restaurant.dash.today': 'Today',
  'restaurant.dash.thisMonth': 'This Month',
  'restaurant.dash.commissionOwed': 'Commission Owed',
  'restaurant.dash.netPayout': 'Net Payout',
  'restaurant.dash.soundOn': 'Sound on',
  'restaurant.dash.soundOff': 'Sound off',
  'restaurant.dash.activeOrders': 'Active orders',
  'restaurant.dash.completed': 'Completed',
  'restaurant.dash.newOrderAlert': 'New order received!',
  'favorites.subtitle': 'Your saved restaurants',
  'favorites.none': 'No favorite restaurants yet',
  'orders.reviewed': 'Reviewed',
  'orders.leaveReview': 'Leave a Review',
  'driver.onboard.title': 'Become a Driver',
  'driver.onboard.subtitle': 'Complete your application to start earning with Kiyo Food',
  'driver.onboard.success.title': 'Application Submitted!',
  'driver.onboard.success.body': 'Your driver application is being reviewed. You will be notified once approved.',
  'driver.onboard.success.redirect': 'Redirecting to dashboard...',
  'driver.onboard.step.vehicle': 'Select Your Vehicle',
  'driver.onboard.step.details': 'Vehicle Details',
  'driver.onboard.licensePlate': 'License Plate Number',
  'driver.onboard.licenseNumber': "Driver's License Number",
  'driver.onboard.idNumber': 'National ID Number',
  'driver.onboard.uploadDocuments': 'Upload Documents',
  'driver.onboard.uploadPrompt': 'Upload license, ID, and vehicle registration',
  'driver.onboard.uploadFormat': 'PNG, JPG, or PDF',
  'driver.onboard.contactTitle': 'Contact Information',
  'driver.onboard.phone': 'Phone Number',
  'driver.onboard.phoneHelp': "We'll use this number to contact you about deliveries",
  'driver.onboard.summary': 'Application Summary',
  'driver.onboard.vehicle': 'Vehicle',
  'driver.onboard.plate': 'Plate',
  'driver.onboard.license': 'License',
  'driver.onboard.id': 'ID',
  'driver.onboard.documents': 'Documents',
  'driver.onboard.submit': 'Submit Application',
  'driver.vehicle.bicycle': 'Bicycle',
  'driver.vehicle.bicycle.desc': 'Eco-friendly for short distances',
  'driver.vehicle.motorcycle': 'Motorcycle',
  'driver.vehicle.motorcycle.desc': 'Fast delivery in urban areas',
  'driver.vehicle.scooter': 'Scooter',
  'driver.vehicle.scooter.desc': 'Efficient for city deliveries',
  'driver.vehicle.car': 'Car',
  'driver.vehicle.car.desc': 'Ideal for longer distances',
  'common.continue': 'Continue',
  'common.to': 'to',
  'common.closed': 'Closed',
  'day.0': 'Sunday',
  'day.1': 'Monday',
  'day.2': 'Tuesday',
  'day.3': 'Wednesday',
  'day.4': 'Thursday',
  'day.5': 'Friday',
  'day.6': 'Saturday',
  'driver.dash.pendingVerification': 'Your account is pending verification. You will be notified once approved.',
  'driver.dash.failedLoad': 'Failed to load driver profile',
  'driver.dash.onlineAccepting': 'Online - Accepting deliveries',
  'driver.dash.offline': 'Offline',
  'driver.dash.goOnline': 'Go Online',
  'driver.dash.online': 'Online',
  'driver.dash.today': 'Today',
  'driver.dash.thisWeek': 'This Week',
  'driver.dash.pending': 'Pending',
  'driver.dash.deliveries': 'deliveries',
  'driver.dash.headingToRestaurant': 'Heading to restaurant',
  'driver.dash.orderCollected': 'Order collected',
  'driver.dash.enRouteToCustomer': 'En route to customer',
  'driver.dash.arrived': 'Arrived',
  'driver.dash.markAsDelivered': 'Mark as delivered',
  'driver.dash.newRequest': 'New Delivery Request',
  'driver.dash.pickup': 'Pickup',
  'driver.dash.deliverTo': 'Deliver to',
  'driver.dash.accept': 'Accept',
  'driver.dash.decline': 'Decline',
  'driver.dash.title': 'Driver Dashboard',
  'driver.dash.activeDelivery': 'Active Delivery',
  'driver.dash.waiting': 'Waiting for new delivery requests...',
  'driver.dash.goOnlineHelp': 'Go online to start receiving deliveries',
};

const fr: Dict = {
  'brand.name': 'Kiyo Food',
  'brand.tagline': 'Saveurs locales, livrées.',
  'brand.heroSubtitle': 'Commandez auprès des meilleurs restaurants d\'Algérie avec Kiyo Food. Livraison rapide, prix transparents, paiement à la livraison.',
  'brand.heroFeature1Title': 'Livraison rapide',
  'brand.heroFeature1Desc': 'Vos plats préférés livrés chauds, rapidement, partout dans votre ville.',
  'brand.heroFeature2Title': 'Restaurants vérifiés',
  'brand.heroFeature2Desc': 'Tous nos partenaires sont sélectionnés et vérifiés pour la qualité.',
  'brand.heroFeature3Title': 'Prix transparents',
  'brand.heroFeature3Desc': 'Pas de frais cachés. Vous voyez exactement ce que vous payez.',
  'brand.heroFeature4Title': 'Paiement à la livraison',
  'brand.heroFeature4Desc': 'Payez en espèces à la réception de votre commande.',
  'brand.heroFeature5Title': 'Plateforme locale',
  'brand.heroFeature5Desc': 'Une plateforme conçue pour l\'Algérie, par et pour les Algériens.',
  'brand.heroFeature6Title': 'Commande facile',
  'brand.heroFeature6Desc': 'Quelques taps et votre repas est en route. Simple, rapide, fiable.',
  'brand.whyKiyo': 'Pourquoi choisir Kiyo Food ?',
  'brand.seoDescription': 'Plateforme de livraison de repas en Algérie. Livraison rapide, prix transparents, paiement à la livraison.',
  'brand.areaServed': 'Algérie',
  'auth.login': 'Se connecter',
  'auth.signup': 'Créer un compte',
  'auth.logout': 'Se déconnecter',
  'auth.email': 'Adresse e-mail',
  'auth.phone': 'Numéro de téléphone',
  'auth.password': 'Mot de passe',
  'auth.confirmPassword': 'Confirmer le mot de passe',
  'auth.fullName': 'Nom complet',
  'auth.forgotPassword': 'Mot de passe oublié ?',
  'auth.resetPassword': 'Réinitialiser le mot de passe',
  'auth.resetPasswordCta': 'Envoyer le lien',
  'auth.continueWithGoogle': 'Continuer avec Google',
  'auth.continueWithApple': 'Continuer avec Apple',
  'auth.orContinueWith': 'ou',
  'auth.noAccount': "Vous n'avez pas de compte ?",
  'auth.haveAccount': 'Vous avez déjà un compte ?',
  'auth.chooseRole': 'Je veux',
  'auth.role.customer': 'Commander à manger',
  'auth.role.restaurant': 'Vendre sur Kiyo Food',
  'auth.acceptTerms': "J'accepte les",
  'auth.termsLink': "Conditions d'utilisation",
  'auth.privacyLink': 'Politique de confidentialité',
  'auth.createAccount': 'Créer un compte',
  'auth.signingIn': 'Connexion…',
  'auth.signingUp': 'Création…',
  'auth.sendingReset': 'Envoi du lien…',
  'auth.backToLogin': 'Retour à la connexion',
  'auth.checkEmailReset': 'Vérifiez votre boîte de réception pour le lien de réinitialisation.',
  'auth.sessionRestoring': 'Restauration de votre session…',
  'auth.error.invalidCredentials': 'E-mail ou mot de passe incorrect.',
  'auth.error.emailTaken': 'Un compte avec cet e-mail existe déjà.',
  'auth.error.weakPassword': 'Le mot de passe doit contenir au moins 8 caractères.',
  'auth.error.tooManyAttempts': 'Trop de tentatives. Patientez et réessayez.',
  'auth.error.network': 'Problème de connexion. Vérifiez votre réseau.',
  'auth.error.timeout': 'Cela prend plus de temps que prévu. Réessayez.',
  'auth.error.unknown': "Une erreur s'est produite. Réessayez.",
  'auth.error.passwordMismatch': 'Les mots de passe ne correspondent pas.',
  'auth.error.acceptTerms': "Veuillez accepter les conditions et la politique de confidentialité.",
  'auth.error.invalidEmail': 'Veuillez saisir une adresse e-mail valide.',
  'auth.error.invalidPhone': 'Saisissez un numéro mobile algérien valide commençant par 05, 06, 07 ou +213.',
  'auth.error.emailDelivery': 'Kiyo Food ne peut pas envoyer l’e-mail de réinitialisation. Le service e-mail est temporairement indisponible ; réessayez plus tard ou contactez le support.',
  'auth.error.emailNotConfirmed': 'Confirmez votre e-mail avant de vous connecter. Vérifiez votre boîte de réception pour l’e-mail de confirmation Kiyo Food.',
  'auth.error.popupBlocked': 'Autorisez les popups pour Kiyo Food afin de continuer avec ce fournisseur de connexion.',
  'auth.error.providerNotEnabled': 'Ce fournisseur de connexion n’est pas encore activé. Demandez à l’administrateur de l’activer dans Supabase → Authentication → Providers.',
  'auth.error.invalidRedirect': 'Le fournisseur de connexion a rejeté la redirection. L’administrateur doit ajouter l’URL de rappel Supabase dans la console du fournisseur (voir le guide d’installation).',
  'auth.signupCheckEmailTitle': 'Confirmez votre e-mail',
  'auth.signupCheckEmailBody': 'Votre compte a été créé. Ouvrez l’e-mail de confirmation de Kiyo Food, puis revenez vous connecter.',
  'auth.resetInvalidTitle': 'Lien de réinitialisation expiré',
  'auth.resetInvalidBody': 'Demandez un nouveau lien de réinitialisation. Par sécurité, les liens peuvent expirer ou être utilisés une seule fois.',
  'auth.restaurantAccessTitle': 'Les comptes restaurant sont vérifiés après l’inscription.',
  'auth.restaurantAccessBody': 'Créez d’abord un compte client. L’accès propriétaire de restaurant est accordé via l’onboarding et l’approbation admin, afin que l’inscription publique ne permette pas de choisir un rôle interne.',
  'nav.home': 'Accueil',
  'nav.dashboard': 'Tableau de bord',
  'nav.favorites': 'Favoris',
  'nav.profile': 'Profil',
  'nav.settings': 'Paramètres',
  'nav.auditLogs': "Journal d'audit",
  'nav.users': 'Utilisateurs',
  'nav.restaurants': 'Restaurants',
  'nav.orders': 'Commandes',
  'dash.welcome': 'Bon retour',
  'dash.role': 'Votre rôle',
  'dash.customer.title': 'Votre compte',
  'dash.customer.subtitle': 'Faim ? Parcourez les restaurants près de vous.',
  'dash.restaurant.title': 'Tableau de bord restaurant',
  'dash.restaurant.subtitle': 'Gérez votre menu et vos commandes.',
  'dash.admin.title': 'Contrôle plateforme',
  'dash.admin.subtitle': 'Visibilité complète sur les opérations Kiyo Food.',
  'dash.comingSoon': 'Cette section sera construite dans la prochaine phase.',
  'dash.accountInfo': 'Informations du compte',
  'dash.totalOrders': 'Commandes totales',
  'dash.totalRestaurants': 'Restaurants',
  'dash.totalUsers': 'Utilisateurs',
  'dash.recentActivity': 'Activité récente',
  'error.genericTitle': 'Une erreur est survenue',
  'error.genericBody': "Une erreur inattendue s'est produite. Réessayez ou rechargez la page.",
  'error.retry': 'Réessayer',
  'error.reload': 'Recharger',
  'error.pageNotFound': 'Page introuvable',
  'error.pageNotFoundBody': "La page que vous cherchez n'existe pas ou a été déplacée.",
  'error.goHome': "Aller à l'accueil",
  'error.unauthorizedTitle': 'Veuillez vous connecter',
  'error.unauthorizedBody': 'Vous devez être connecté pour voir cette page.',
  'error.forbiddenTitle': 'Accès refusé',
  'error.forbiddenBody': "Vous n'avez pas la permission de voir cette page.",
  'common.loading': 'Chargement…',
  'common.cancel': 'Annuler',
  'common.save': 'Enregistrer',
  'common.edit': 'Modifier',
  'common.back': 'Retour',
  'common.close': 'Fermer',
  'common.search': 'Rechercher',
  'common.none': '—',
  'common.refunds': 'Remboursements',
  'common.cookies': 'Cookies',
  'audit.title': "Journal d'audit",
  'audit.actor': 'Acteur',
  'audit.action': 'Action',
  'audit.target': 'Cible',
  'audit.time': 'Heure',
  'audit.empty': 'Aucune activité enregistrée pour le moment.',
  'market.browse': 'Parcourir les restaurants',
  'market.openNow': 'Ouverts maintenant',
  'market.freeDelivery': 'Livraison gratuite',
  'market.topRated': 'Les mieux notés',
  'market.empty': 'Aucun restaurant trouvé près de vous.',
  'market.searchPlaceholder': 'Rechercher restaurants ou cuisines…',
  'market.nearMe': 'À proximité',
  'market.locationTooWeak': 'Votre position n’est pas assez précise pour classer les restaurants. Réessayez dans un endroit dégagé.',
  'restaurant.menu': 'Menu',
  'restaurant.owner': 'Propriétaire',
  'restaurant.addToCart': 'Ajouter au panier',
  'restaurant.closed': 'Fermé',
  'restaurant.open': 'Ouvert',
  'restaurant.busy': 'Occupé',
  'restaurant.reviews': 'avis',
  'restaurant.about': 'À propos',
  'restaurant.noMenu': 'Menu non publié.',
  'restaurant.addCategory': 'Ajouter une catégorie',
  'restaurant.addItem': 'Ajouter un plat',
  'restaurant.editItem': 'Modifier',
  'restaurant.newItem': 'Nouveau plat',
  'restaurant.onboard': 'Ouvrir votre restaurant',
  'restaurant.onboard.prompt': 'Inscrivez votre restaurant sur Kiyo Food.',
  'restaurant.onboard.existingOwnerHelp': '(propriétaire de restaurant existant)',
  'restaurant.onboard.noOwners': 'Aucun compte de propriétaire de restaurant n\'existe encore. Demandez d\'abord au propriétaire de s\'inscrire (il choisira "Vendre sur Kiyo" sur le formulaire d\'inscription), puis revenez ici pour créer son restaurant.',
  'restaurant.onboard.invalidName': 'Le nom du restaurant doit contenir au moins 2 caractères.',
  'restaurant.onboard.ownerRequired': 'Sélectionnez un propriétaire de restaurant vérifié avant de créer un restaurant.',
  'restaurant.onboard.locationTitle': 'Emplacement du restaurant',
  'restaurant.onboard.locationHelp': 'Utilisez le GPS ou placez l’épingle exactement sur l’entrée du restaurant avant publication.',
  'restaurant.onboard.coordinatesSaved': 'Coordonnées enregistrées',
  'restaurant.onboard.pendingNotice': 'Créé en tant que "en attente d\'approbation". Examinez et publiez depuis la page de gestion des restaurants.',
  'restaurant.phone': 'Téléphone',
  'restaurant.address': 'Adresse',
  'restaurant.cuisine': 'Cuisine (séparée par virgules)',
  'restaurant.image': 'URL image',
  'restaurant.create': 'Créer le restaurant',
  'restaurant.creating': 'Création…',
  'restaurant.openRestaurant': 'Ouvrir un restaurant',
  'restaurant.available': 'Disponible',
  'restaurant.outOfStock': 'Épuisé',
  'restaurant.price': 'Prix (DZD)',
  'restaurant.categoryName': 'Nom de catégorie',
  'restaurant.itemName': 'Nom du plat',
  'restaurant.description': 'Description',
  'restaurant.delete': 'Supprimer',
  'restaurant.dashboard': 'Tableau restaurant',
  'restaurant.manageMenu': 'Gérer le menu',
  'restaurant.waitingOrders': 'Commandes entrantes',
  'restaurant.noOrders': 'Aucune nouvelle commande.',
  'restaurant.apply.nav': 'Devenir restaurant',
  'restaurant.apply.title': 'Candidature restaurant',
  'restaurant.apply.subtitle': 'Soumettez votre restaurant pour validation. Il reste en attente jusqu’à l’approbation de Kiyo Food.',
  'restaurant.apply.name': 'Nom du restaurant',
  'restaurant.apply.legalName': 'Nom légal de l’entreprise',
  'restaurant.apply.openingHours': 'Heures d’ouverture',
  'restaurant.apply.openingHoursPlaceholder': 'Exemple : dimanche à jeudi 11:00-23:00, vendredi 15:00-23:30',
  'restaurant.apply.logo': 'Logo du restaurant',
  'restaurant.apply.cover': 'Image de couverture',
  'restaurant.apply.submit': 'Soumettre la candidature',
  'restaurant.apply.submitting': 'Envoi...',
  'restaurant.apply.successTitle': 'Candidature envoyée',
  'restaurant.apply.successBody': 'Votre restaurant est en attente de validation. Kiyo Food l’approuvera ou enverra une raison claire de rejet pour modification et renvoi.',
  'restaurant.apply.errorName': 'Saisissez un nom de restaurant valide.',
  'restaurant.apply.errorPhone': 'Saisissez un numéro de téléphone valide.',
  'restaurant.apply.errorAddress': 'Saisissez une adresse de restaurant valide.',
  'restaurant.apply.errorLocation': 'Placez le restaurant sur la carte.',
  'restaurant.apply.errorDelivery': 'Saisissez un rayon de livraison entre 1 et 100 km.',
  'restaurant.apply.errorMinOrder': 'Le minimum de commande ne peut pas être négatif.',
  'map.searchPlaceholder': 'Rechercher une adresse, un quartier, une ville...',
  'map.useCurrentLocation': 'Utiliser ma position actuelle',
  'map.locating': 'Localisation...',
  'map.gps': 'GPS',
  'map.searching': 'Recherche d’adresses...',
  'map.loading': 'Chargement de la carte...',
  'map.locationUnavailable': 'La position est indisponible. Vous pouvez rechercher une adresse ou toucher la carte pour choisir le point de livraison.',
  'map.locationOutsideAlgeria': 'Cette position est hors d’Algérie. Recherchez une adresse ou placez l’épingle dans la zone couverte.',
  'map.gpsWeak': 'La précision GPS est faible. L’épingle a été placée, mais confirmez-la ou déplacez-la vers l’entrée exacte.',
  'map.gpsApproximate': 'La position GPS est approximative. L’épingle a été placée, mais déplacez-la vers l’entrée exacte avant l’envoi.',
  'map.improvingAccuracy': 'Amélioration de la précision GPS...',
  'map.restaurantConfirmRequired': 'La position du restaurant doit être exacte. Déplacez l’épingle vers l’entrée et confirmez-la.',
  'map.confirmWeakGps': 'Le GPS reste faible. Déplacez l’épingle vers l’entrée exacte et confirmez-la avant l’enregistrement.',
  'map.confirmDraggedPin': 'Confirmez cette épingle exacte avant l’enregistrement.',
  'map.confirmSearchPin': 'La recherche a trouvé cette zone. Déplacez l’épingle si nécessaire, puis confirmez le lieu exact.',
  'map.pinConfirmed': 'Épingle confirmée',
  'map.pinNeedsConfirmation': 'Épingle à confirmer',
  'map.confirmPin': 'Confirmer l’épingle exacte',
  'map.confirmRequired': 'Confirmez l’épingle exacte sur la carte avant de continuer.',
  'map.tileFallbackActive': 'La carte utilise une source de secours car les tuiles principales sont lentes.',
  'map.tileReconnecting': 'La carte se reconnecte. Votre épingle reste enregistrée.',
  'map.distance': 'Distance',
  'map.max': 'max',
  'map.gpsAccuracy': 'Précision GPS',
  'map.heading': 'direction',
  'map.outsideZone': 'Cette adresse est hors de la zone de livraison du restaurant',
  'map.locationDeliveryZone': 'Position et zone de livraison',
  'map.locationUnavailableShort': 'Position indisponible pour ce restaurant.',
  'map.trackingRiderEnRoute': 'Livreur en route',
  'map.trackingPreparing': 'Commande en préparation',
  'map.trackingLive': 'Commande en direct',
  'map.driverWeakGps': 'La précision GPS est faible. Approchez-vous d’une fenêtre ou d’un espace ouvert.',
  'map.driverJump': 'Déplacement anormal détecté. Gardez le GPS activé pour une livraison fiable.',
  'map.driverSyncFailed': 'La synchronisation GPS a échoué. Gardez cette page ouverte et vérifiez l’autorisation de localisation.',
  'map.driverPermissionRequired': 'L’autorisation de localisation est nécessaire lorsque vous êtes en ligne.',
  'map.searchUnavailable': 'La recherche d’adresse est temporairement indisponible. Vous pouvez déplacer la carte pour choisir le point exact.',
  'map.addressStillLoading': 'Les services d’adresse sont en cours de chargement. Patientez un instant puis réessayez.',
  'map.addressNotFound': 'Aucune adresse précise n’a été trouvée ici. Déplacez la carte jusqu’à l’entrée exacte puis confirmez le repère.',
  'map.addressApproximate': 'Ce résultat indique une zone, pas une entrée précise. Déplacez la carte jusqu’au bon point avant de confirmer.',
  'map.locationSelector': 'Choisir un emplacement exact',
  'map.restaurantMarker': 'Emplacement du restaurant',
  'map.currentPosition': 'Position GPS actuelle',
  'map.satelliteView': 'Afficher la vue satellite',
  'map.standardView': 'Afficher la carte standard',
  'map.releaseToSelect': 'Relâchez la carte pour sélectionner ce point',
  'map.outsideZoneShort': 'Hors zone de livraison',
  'map.movePinRequired': 'Déplacez la carte jusqu’au point exact',
  'map.selectionHelp': 'Recherchez une adresse, utilisez votre position actuelle ou déplacez la carte jusqu’à l’entrée exacte.',
  'map.permissionDenied': 'La demande de localisation n’a pas été autorisée. Vérifiez l’autorisation du site et les services de localisation de l’appareil, puis réessayez ou saisissez l’adresse.',
  'map.iosLocationRequestFailed': 'Safari n’a pas pu autoriser cette demande. Dans Réglages iPhone, vérifiez Confidentialité et sécurité → Service de localisation → Sites web Safari, activez Position exacte, puis réessayez ou saisissez l’adresse.',
  'map.positionUnavailable': 'L’autorisation peut être accordée, mais l’appareil n’a pas pu déterminer la position. Activez le service de localisation, placez-vous dans un endroit dégagé, puis réessayez ou saisissez l’adresse.',
  'map.locationUnsupported': 'Ce navigateur ne fournit pas la position. Recherchez l’adresse ou choisissez le point manuellement.',
  'map.locationTimeout': 'Le GPS a mis trop de temps à répondre. Placez-vous dans un endroit dégagé et réessayez, ou choisissez le point manuellement.',
  'map.confirmGpsPin': 'Le GPS a trouvé ce point. Vérifiez l’entrée sur la carte, puis confirmez l’épingle.',
  'map.loadFailedTitle': 'Impossible de charger la carte',
  'map.loadFailedBody': 'Vérifiez votre connexion puis réessayez. Les données du formulaire sont conservées.',
  'map.configurationMissingTitle': 'Le service de carte est indisponible',
  'map.configurationMissingBody': 'La sélection d’emplacement est temporairement indisponible. Réessayez dans un instant.',
  'map.customerMarker': 'Adresse de livraison',
  'map.driverMarker': 'Position du livreur',
  'map.coverageTitle': 'Carte de l’activité de livraison',
  'map.coverageFilter': 'Filtrer l’activité de la carte',
  'map.coverageAll': 'Toute l’activité',
  'map.coverageDestinations': 'Destinations',
  'map.coverageRestaurants': 'Restaurants',
  'map.coverageAnalyzing': 'Analyse de l’activité géographique...',
  'map.coverageEmpty': 'Aucune donnée de localisation vérifiée ne correspond à ce filtre.',
  'map.coverageSummary': 'points de localisation vérifiés affichés pour planifier la couverture opérationnelle.',
  'map.coverageLoadFailed': 'Impossible de charger l’activité géographique. Vérifiez l’accès propriétaire puis réessayez.',
  'map.gpsLive': 'en direct',
  'map.gpsIdle': 'en attente',
  'map.gpsError': 'indisponible',
  'map.offlineTitle': 'Vous êtes hors ligne',
  'map.offlineBody': 'Reconnectez-vous pour charger la carte. Votre adresse et les informations du formulaire sont conservées.',
  'map.recenter': 'Recentrer sur ma position',
  'map.weakConnection': 'Connexion faible — certaines fonctions de la carte peuvent être retardées.',
  'map.tilesSlow': 'La carte charge sur une connexion lente. Votre dernière position reste disponible pendant la nouvelle tentative.',
  'map.gpsWeakMeasured': 'Le GPS ne vous localise qu’à environ',
  'map.gpsWeakAction': 'Réessayez dans un endroit dégagé ou saisissez l’adresse manuellement ; cette mesure n’a pas été sélectionnée.',
  'map.retryGps': 'Réessayer le GPS',
  'map.enterManually': 'Saisir l’adresse',
  'map.outsideBy': 'hors de cette zone de livraison',
  'map.findAvailableRestaurants': 'Voir les restaurants disponibles',
  'map.zoomIn': 'Zoom avant',
  'map.zoomOut': 'Zoom arrière',
  'map.accuracy.excellent': 'Excellente',
  'map.accuracy.good': 'Bonne',
  'map.accuracy.acceptable': 'À confirmer',
  'map.accuracy.weak': 'Faible',
  'map.accuracy.unknown': 'Inconnue',
  'location.deliverTo': 'Livrer à',
  'location.chooseExact': 'Choisir une adresse exacte',
  'location.title': 'Où devons-nous livrer ?',
  'location.privacy': 'Recherchez, utilisez le GPS, puis confirmez l’entrée exacte sur la carte.',
  'location.saved': 'Adresses enregistrées et récentes',
  'location.noSaved': 'Aucune adresse enregistrée. Choisissez un point exact sur la carte.',
  'location.privacyShort': 'Votre position précise sert uniquement à vérifier la livraison et à apporter votre commande.',
  'location.landmark': 'Point de repère',
  'location.instructions': 'Instructions pour le livreur',
  'location.webAccuracyNotice': 'Pour une meilleure précision, recherchez votre adresse ou placez manuellement le repère sur la carte au lieu de vous fier uniquement au GPS. Notre prochaine application mobile offrira une localisation nettement plus précise.',
  'location.dismissAccuracyNotice': 'Fermer l’information sur la précision',
  'location.notConfirmed': 'Aucun point de livraison exact confirmé',
  'location.ready': 'Les coordonnées exactes sont prêtes pour la livraison.',
  'location.confirmOnMap': 'Confirmez l’épingle sur la carte avant de continuer.',
  'location.confirmDelivery': 'Confirmer le lieu de livraison',
  'location.customLabel': 'Nom de l’adresse (facultatif)',
  'location.quoteSummary': 'Distance de livraison vérifiée',
  'location.etaMinutes': 'Arrivée estimée (minutes)',
  'location.useSaved': 'Utiliser une adresse enregistrée',
  'location.defaultAddress': 'Par défaut',
  'location.differentLocation': 'Livrer à une autre adresse',
  'location.recent': 'Position récente',
  'location.recentNeedsConfirmation': 'Vérifiez ce point récent sur la carte avant de le confirmer.',
  'location.confirmedSuccess': 'Adresse confirmée',
  'location.restaurantsDeliverHere': 'restaurants livrent à cette adresse',
  'location.restaurantDeliversHere': 'restaurant livre à cette adresse',
  'location.etaRange': 'Livraison estimée',
  'location.minutesShort': 'min',
  'location.savePrompt': 'Enregistrer cette adresse comme Maison ou Travail pour commander plus vite la prochaine fois ?',
  'location.saveAsHome': 'Maison',
  'location.saveAsWork': 'Travail',
  'location.notNow': 'Pas maintenant',
  'cart.title': 'Votre panier',
  'cart.empty': 'Votre panier est vide',
  'cart.emptyBody': 'Parcourez les restaurants pour ajouter des plats.',
  'cart.subtotal': 'Sous-total',
  'cart.deliveryFee': 'Frais de livraison',
  'cart.serviceFee': 'Frais de service',
  'cart.total': 'Total',
  'cart.checkout': 'Commander',
  'cart.removeItem': 'Retirer',
  'cart.clear': 'Vider le panier',
  'cart.switchWarning': 'Ajouter des plats d\'un autre restaurant remplacera votre panier.',
  'checkout.step.cart': 'Panier',
  'checkout.step.details': 'Livraison',
  'checkout.step.confirm': 'Confirmer',
  'checkout.fullName': 'Nom complet',
  'checkout.phone': 'Téléphone',
  'checkout.contactQuestion': 'Quel numéro le restaurant ou le livreur doit-il utiliser pour cette commande ?',
  'checkout.useAccountPhone': 'Utiliser le numéro de mon compte',
  'checkout.useDifferentPhone': 'Utiliser un autre numéro pour cette commande',
  'checkout.accountPhoneMissing': 'Aucun numéro enregistré sur ce compte',
  'checkout.alternatePhoneLabel': 'Numéro de téléphone pour cette commande',
  'checkout.address': 'Adresse de livraison',
  'checkout.notes': 'Notes',
  'checkout.notesPlaceholder': 'ex. sans oignons, très épicé',
  'checkout.placeOrder': 'Valider la commande',
  'checkout.placing': 'Envoi…',
  'checkout.delivery': 'Livraison',
  'checkout.placeOrderSummary': 'Un calculé selon la distance. Kiyo Food fixe ce montant.',
  'checkout.success': 'Commande passée !',
  'checkout.successBody': 'Votre commande a été envoyée au restaurant.',
  'checkout.deliveryByRestaurant': 'La livraison est gérée directement par le restaurant.',
  'checkout.viewOrders': 'Voir mes commandes',
  'checkout.backToCart': 'Retour au panier',
  'checkout.backToDetails': 'Retour',
  'checkout.idle': 'Prêt à valider',
  'checkout.empty': 'Votre panier est vide.',
  'checkout.noRestaurant': 'Aucun restaurant sélectionné.',
  'checkout.error': 'Impossible de valider la commande.',
  'checkout.errorCalc': 'Impossible de calculer les frais. Réessayez.',
  'checkout.deliveryPlaceholder': 'Rue, bâtiment, étage…',
  'checkout.invalidPhone': 'Numéro invalide.',
  'checkout.invalidAddress': 'Saisissez une adresse.',
  'orders.title': 'Vos commandes',
  'orders.id': 'Commande',
  'orders.items': 'articles',
  'orders.status': 'Statut',
  'orders.empty': 'Aucune commande pour le moment.',
  'orders.total': 'Total',
  'orders.placed': 'Passée',
  'orders.track': 'Suivre',
  'orders.reorder': 'Recommander',
  'status.pending': 'En attente',
  'status.accepted': 'Acceptée',
  'status.preparing': 'En préparation',
  'status.out_for_delivery': 'En livraison',
  'status.delivered': 'Livrée',
  'status.cancelled': 'Annulée',
  'status.accept': 'Accepter',
  'status.reject': 'Refuser',
  'status.startPreparing': 'Préparer',
  'status.markOutForDelivery': 'En livraison',
  'status.markDelivered': 'Marquer livrée',
  'status.cancelOrder': 'Annuler',
  'status.failed_delivery': 'Échec de livraison',
  'status.markFailedDelivery': 'Marquer échec',
  'status.refunded': 'Remboursé',
  'admin.restaurantsManagement': 'Restaurants',
  'admin.approve': 'Approuver',
  'admin.reject': 'Rejeter',
  'admin.pendingApproval': 'En attente',
  'admin.noPending': 'Aucune demande en attente.',
  'wilaya.select': 'Sélectionner wilaya',
  'wilaya.searchPlaceholder': 'Rechercher une wilaya…',
  'wilaya.detectLocation': 'Détecter ma position',
  'wilaya.detecting': 'Détection…',
  'wilaya.noResults': 'Aucune wilaya trouvée.',
  'wilaya.detectError': 'Votre wilaya n’a pas pu être déterminée avec certitude. Sélectionnez-la manuellement.',
  'wilaya.permissionDenied': 'L’accès à la position est bloqué. Autorisez-le dans le navigateur ou sélectionnez votre wilaya manuellement.',
  'wilaya.locationTooWeak': 'Votre position n’est pas assez précise pour choisir une wilaya de manière fiable. Sélectionnez-la manuellement.',
  'nav.controlCenter': 'Centre de contrôle',
  'nav.driverDashboard': 'Tableau de bord livreur',
  'nav.support': 'Support',
  'role.super_admin': 'Super Administrateur',
  'role.restaurant_owner': 'Propriétaire de Restaurant',
  'role.customer': 'Client',
  'role.driver': 'Livreur',
  'sys.underMaintenance': 'En Maintenance',
  'sys.maintenanceDesc': 'Nous effectuons une maintenance planifiée. Veuillez revenir bientôt.',
  'admin.controlCenter': 'Centre de contrôle',
  'admin.fullVisibility': 'Visibilité et gestion complètes de la plateforme',
  'admin.financialsDesc': 'Finances, utilisateurs, restaurants, règles, analyses',
  // support
  'support.title': 'Support client',
  'support.subtitle': "Obtenez de l'aide pour vos commandes, paiements ou compte",
  'support.newTicket': 'Nouveau ticket',
  'support.noTickets': 'Aucun ticket de support pour le moment',
  'support.needHelp': 'Besoin d\'aide ? Créez un ticket ci-dessus.',
  'support.prioritySuffix': 'priorité',
  'support.form.subject': 'Sujet',
  'support.form.subjectPlaceholder': 'Description rapide de votre problème',
  'support.form.category': 'Catégorie',
  'support.form.priority': 'Priorité',
  'support.form.orderIdOptional': 'ID de commande (optionnel)',
  'support.form.orderIdPlaceholder': 'Collez l\'ID de commande si lié à une commande spécifique',
  'support.form.description': 'Description',
  'support.form.descriptionPlaceholder': 'Décrivez votre problème en détail...',
  'support.form.submit': 'Envoyer le ticket',
  'support.form.validation': 'Veuillez remplir le sujet et la description',
  'support.backToTickets': 'Retour aux tickets',
  'support.conversation': 'Discussion',
  'support.noMessages': 'Aucun message pour le moment. Démarrez la discussion ci-dessous.',
  'support.typeReply': 'Écrivez votre réponse...',
  'support.category.general': 'Général',
  'support.category.bug': 'Bug / Technique',
  'support.category.abuse': 'Abus / Signalement',
  'support.category.complaint': 'Réclamation',
  'support.category.billing': 'Facturation / Paiement',
  'support.category.other': 'Autre',
  'support.priority.low': 'Basse',
  'support.priority.normal': 'Normale',
  'support.priority.high': 'Haute',
  'support.priority.urgent': 'Urgente',
  'support.you': 'Vous',
  'support.staff': 'Support',
  // profile & privacy
  'profile.loyalty.title': 'Programme de fidélité',
  'profile.loyalty.subtitle': 'Gagnez 1 point pour chaque 100 DZD dépensé',
  'profile.loyalty.currentPoints': 'Points actuels',
  'profile.loyalty.lifetimePoints': 'Points cumulés',
  'profile.loyalty.nextTier': 'Prochain niveau',
  'profile.loyalty.maxTier': 'Niveau maximum atteint !',
  'profile.phone': 'Téléphone',
  'profile.language': 'Langue',
  'profile.addresses.title': 'Adresses enregistrées',
  'profile.addresses.addNew': 'Ajouter',
  'profile.addresses.label': 'Libellé',
  'profile.addresses.home': 'Maison',
  'profile.addresses.work': 'Travail',
  'profile.addresses.family': 'Famille',
  'profile.addresses.other': 'Autre',
  'profile.addresses.default': 'Par défaut',
  'profile.addresses.setAsDefault': 'Définir par défaut',
  'profile.addresses.favorite': 'Favori',
  'profile.addresses.duplicate': 'Dupliquer',
  'profile.addresses.archive': 'Archiver',
  'profile.addresses.delete': 'Supprimer',
  'profile.addresses.none': 'Aucune adresse enregistrée. Ajoutez votre maison, travail ou lieu de livraison.',
  'profile.addresses.signinToManage': 'Connectez-vous pour gérer vos adresses enregistrées.',
  'profile.addresses.save': 'Enregistrer l\'adresse',
  'profile.privacy.title': 'Confidentialité et données',
  'profile.privacy.subtitle': 'Vos données, votre contrôle. Exportez ou supprimez vos données conformément à notre politique de suppression de compte.',
  'profile.privacy.export': 'Exporter mes données',
  'profile.privacy.exportDesc': 'Télécharger au format JSON',
  'profile.privacy.delete': 'Supprimer mon compte',
  'profile.privacy.deleteDesc': 'Définitif après 14 jours',
  'profile.privacy.exportSuccess': 'Exportation téléchargée.',
  'profile.privacy.exportFailed': 'Échec de l\'exportation. Veuillez réessayer.',
  'profile.privacy.policy': 'Politique de confidentialité',
  'profile.privacy.cookie': 'Politique relative aux cookies',
  'profile.privacy.refund': 'Remboursement et annulation',
  // deletion modal
  'profile.deleteModal.title': 'Supprimer le compte',
  'profile.deleteModal.body1': 'Cela vous déconnectera immédiatement et verrouillera votre compte. Votre profil, vos favoris et vos données enregistrées seront supprimés dans un délai de 14 jours.',
  'profile.deleteModal.body2': 'Les dossiers de commande et financiers sont conservés pendant 7 ans, comme l\'exige la loi fiscale, mais ils seront anonymisés et ne seront plus liés à votre identité.',
  'profile.deleteModal.warn': 'Les comptes de propriétaires de restaurant avec un restaurant actif ne peuvent pas se supprimer eux-mêmes. Contactez le support.',
  'profile.deleteModal.confirmText': 'Écrivez DELETE pour confirmer',
  'profile.deleteModal.deleteForever': 'Supprimer définitivement',
  'profile.deleteModal.deleting': 'Suppression…',
  // driver dashboard & onboarding
  'driver.dashboard': 'Tableau de bord du livreur',
  'driver.activeDelivery': 'Livraison active',
  'driver.waitingRequests': 'En attente de nouvelles demandes de livraison...',
  'driver.goOnlineDesc': 'Passez en ligne pour commencer à recevoir des livraisons',
  'driver.onboarding.title': 'Devenir livreur',
  'driver.onboarding.subtitle': 'Complétez votre candidature pour commencer à gagner de l\'argent',
  'driver.onboarding.successTitle': 'Candidature envoyée !',
  'driver.onboarding.successBody': 'Votre candidature est en cours d\'examen. Vous serez informé dès son approbation.',
  'driver.onboarding.redirecting': 'Redirection vers le tableau de bord...',
  'driver.onboarding.step1Title': 'Sélectionnez votre véhicule',
  'driver.onboarding.step2Title': 'Détails du véhicule',
  'driver.onboarding.step3Title': 'Coordonnées de contact',
  'driver.onboarding.licensePlate': 'Numéro de plaque d\'immatriculation',
  'driver.onboarding.licenseNumber': 'Numéro de permis de conduire',
  'driver.onboarding.idNumber': 'Numéro de carte d\'identité nationale',
  'driver.onboarding.uploadDocs': 'Télécharger les documents',
  'driver.onboarding.uploadPrompt': 'Télécharger permis, ID et carte grise',
  'driver.onboarding.uploadFormat': 'PNG, JPG ou PDF',
  'driver.onboarding.phonePrompt': 'Nous utiliserons ce numéro pour vous contacter au sujet des livraisons',
  'driver.onboarding.appSummary': 'Résumé de la candidature',
  // reset password
  'auth.resetPasswordSuccess': 'Mot de passe réinitialisé !',
  'auth.resetPasswordSuccessBody': 'Votre mot de passe a été mis à jour avec succès.',
  'auth.newPassword': 'Nouveau mot de passe',
  'auth.newPasswordPrompt': 'Saisissez votre nouveau mot de passe ci-dessous.',
  'auth.updating': 'Mise à jour...',
  'auth.savePassword': 'Enregistrer le mot de passe',
  // restaurant settings
  'restaurant.settings.title': 'Paramètres du restaurant',
  'restaurant.settings.businessHours': 'Heures d\'ouverture',
  'restaurant.settings.hoursDesc': 'Définissez vos heures d\'ouverture et de fermeture pour chaque jour. Laissez décoché pour marquer comme fermé.',
  'restaurant.settings.deliveryConfig': 'Configuration de la livraison',
  'restaurant.settings.maxRadius': 'Rayon de livraison max (km)',
  'restaurant.settings.maxRadiusDesc': 'Les clients en dehors de ce rayon ne peuvent pas commander.',
  'restaurant.settings.minOrder': 'Montant minimum de commande (DZD)',
  'restaurant.settings.minOrderDesc': 'Les commandes inférieures à ce montant seront rejetées.',
  'restaurant.settings.estTime': 'Temps de livraison estimé (minutes)',
  'restaurant.settings.estTimeDesc': 'Ceci est affiché aux clients avant qu\'ils ne commandent.',
  'restaurant.settings.opStatus': 'Statut opérationnel',
  'restaurant.settings.opStatusDesc': 'Ouvert: Accepte les commandes. Occupé: Temps de préparation prolongés. Fermé: Ne prend pas de commandes.',
  'restaurant.settings.saving': 'Enregistrement...',
  'restaurant.settings.saveSettings': 'Enregistrer les paramètres',
  'restaurant.settings.saved': 'Paramètres enregistrés !',
  'restaurant.settings.commissionRate': 'Marge bénéficiaire / Taux de commission (%)',
  'restaurant.settings.commissionDesc': 'Définissez le pourcentage de commission de votre restaurant. Ceci est stocké directement dans le profil de votre restaurant et utilisé pour diviser les versements de la plateforme.',
  'restaurant.settings.invalidCommissionRate': 'Veuillez saisir un pourcentage de commission valide entre 0 et 100.',
  'restaurant.settings.financialTitle': 'Paramètres Financiers',
  'restaurant.dash.today': 'Aujourd\'hui',
  'restaurant.dash.thisMonth': 'Ce mois-ci',
  'restaurant.dash.commissionOwed': 'Commission due',
  'restaurant.dash.netPayout': 'Versement net',
  'restaurant.dash.soundOn': 'Son activé',
  'restaurant.dash.soundOff': 'Son désactivé',
  'restaurant.dash.activeOrders': 'Commandes actives',
  'restaurant.dash.completed': 'Terminées',
  'restaurant.dash.newOrderAlert': 'Nouvelle commande reçue !',
  'favorites.subtitle': 'Vos restaurants enregistrés',
  'favorites.none': 'Aucun restaurant favori pour le moment',
  'orders.reviewed': 'Avis laissé',
  'orders.leaveReview': 'Laisser un avis',
  'driver.onboard.title': 'Devenir chauffeur',
  'driver.onboard.subtitle': 'Complétez votre candidature pour commencer à gagner avec Kiyo Food',
  'driver.onboard.success.title': 'Candidature soumise !',
  'driver.onboard.success.body': 'Votre candidature de chauffeur est en cours d\'examen. Vous serez averti une fois approuvé.',
  'driver.onboard.success.redirect': 'Redirection vers le tableau de bord...',
  'driver.onboard.step.vehicle': 'Sélectionnez votre véhicule',
  'driver.onboard.step.details': 'Détails du véhicule',
  'driver.onboard.licensePlate': 'Numéro de plaque d\'immatriculation',
  'driver.onboard.licenseNumber': 'Numéro de permis de conduire',
  'driver.onboard.idNumber': 'Numéro de carte d\'identité nationale',
  'driver.onboard.uploadDocuments': 'Télécharger des documents',
  'driver.onboard.uploadPrompt': 'Téléchargez le permis, la pièce d\'identité et l\'immatriculation du véhicule',
  'driver.onboard.uploadFormat': 'PNG, JPG ou PDF',
  'driver.onboard.contactTitle': 'Informations de contact',
  'driver.onboard.phone': 'Numéro de téléphone',
  'driver.onboard.phoneHelp': 'Nous utiliserons ce numéro pour vous contacter concernant les livraisons',
  'driver.onboard.summary': 'Résumé de la candidature',
  'driver.onboard.vehicle': 'Véhicule',
  'driver.onboard.plate': 'Plaque',
  'driver.onboard.license': 'Permis',
  'driver.onboard.id': 'Pièce d\'identité',
  'driver.onboard.documents': 'Documents',
  'driver.onboard.submit': 'Soumettre la candidature',
  'driver.vehicle.bicycle': 'Vélo',
  'driver.vehicle.bicycle.desc': 'Écologique pour les courtes distances',
  'driver.vehicle.motorcycle': 'Moto',
  'driver.vehicle.motorcycle.desc': 'Livraison rapide dans les zones urbaines',
  'driver.vehicle.scooter': 'Scooter',
  'driver.vehicle.scooter.desc': 'Efficace pour les livraisons en ville',
  'driver.vehicle.car': 'Voiture',
  'driver.vehicle.car.desc': 'Idéal pour les plus longues distances',
  'common.continue': 'Continuer',
  'common.to': 'à',
  'common.closed': 'Fermé',
  'day.0': 'Dimanche',
  'day.1': 'Lundi',
  'day.2': 'Mardi',
  'day.3': 'Mercredi',
  'day.4': 'Jeudi',
  'day.5': 'Vendredi',
  'day.6': 'Samedi',
  'driver.dash.pendingVerification': 'Votre compte est en attente de vérification. Vous serez informé dès son approbation.',
  'driver.dash.failedLoad': 'Échec du chargement du profil de livreur',
  'driver.dash.onlineAccepting': 'En ligne - Accepte les livraisons',
  'driver.dash.offline': 'Hors ligne',
  'driver.dash.goOnline': 'Passer en ligne',
  'driver.dash.online': 'En ligne',
  'driver.dash.today': 'Aujourd\'hui',
  'driver.dash.thisWeek': 'Cette semaine',
  'driver.dash.pending': 'En attente',
  'driver.dash.deliveries': 'livraisons',
  'driver.dash.headingToRestaurant': 'En route vers le restaurant',
  'driver.dash.orderCollected': 'Commande récupérée',
  'driver.dash.enRouteToCustomer': 'En route vers le client',
  'driver.dash.arrived': 'Arrivé',
  'driver.dash.markAsDelivered': 'Marquer comme livré',
  'driver.dash.newRequest': 'Nouvelle demande de livraison',
  'driver.dash.pickup': 'Récupération',
  'driver.dash.deliverTo': 'Livrer à',
  'driver.dash.accept': 'Accepter',
  'driver.dash.decline': 'Décliner',
  'driver.dash.title': 'Tableau de bord du livreur',
  'driver.dash.activeDelivery': 'Livraison active',
  'driver.dash.waiting': 'En attente de nouvelles demandes de livraison...',
  'driver.dash.goOnlineHelp': 'Passez en ligne pour commencer à recevoir des livraisons',
};

const ar: Dict = {
  'brand.name': 'كيو',
  'brand.tagline': 'نكهات محلية، تُوصَل إليك.',
  'brand.heroSubtitle': 'اطلب من أفضل المطاعم في الجزائر مع كيو. توصيل سريع، أسعار شفافة، الدفع عند الاستلام.',
  'brand.heroFeature1Title': 'توصيل سريع',
  'brand.heroFeature1Desc': 'أطباقك المفضلة تصل ساخنة، بسرعة، في أي مكان بمدينتك.',
  'brand.heroFeature2Title': 'مطاعم موثوقة',
  'brand.heroFeature2Desc': 'جميع شركائنا مختارون وموثوقون للجودة.',
  'brand.heroFeature3Title': 'أسعار شفافة',
  'brand.heroFeature3Desc': 'بدون رسوم خفية. ترى بالضبط ما تدفعه.',
  'brand.heroFeature4Title': 'الدفع عند الاستلام',
  'brand.heroFeature4Desc': 'ادفع نقداً عند استلام طلبك.',
  'brand.heroFeature5Title': 'منصة محلية',
  'brand.heroFeature5Desc': 'منصة مصممة للجزائر، من وإجل الجزائريين.',
  'brand.heroFeature6Title': 'طلب سهل',
  'brand.heroFeature6Desc': 'بضع نقرات ووجبتك في الطريق. بسيط، سريع، موثوق.',
  'brand.whyKiyo': 'لماذا تختار كيو؟',
  'brand.seoDescription': 'منصة توصيل الطعام الجزائرية. توصيل سريع، أسعار شفافة، الدفع عند الاستلام.',
  'brand.areaServed': 'الجزائر',
  'auth.login': 'تسجيل الدخول',
  'auth.signup': 'إنشاء حساب',
  'auth.logout': 'تسجيل الخروج',
  'auth.email': 'البريد الإلكتروني',
  'auth.phone': 'رقم الهاتف',
  'auth.password': 'كلمة المرور',
  'auth.confirmPassword': 'تأكيد كلمة المرور',
  'auth.fullName': 'الاسم الكامل',
  'auth.forgotPassword': 'نسيت كلمة المرور؟',
  'auth.resetPassword': 'إعادة تعيين كلمة المرور',
  'auth.resetPasswordCta': 'إرسال الرابط',
  'auth.continueWithGoogle': 'المتابعة عبر Google',
  'auth.continueWithApple': 'المتابعة عبر Apple',
  'auth.orContinueWith': 'أو',
  'auth.noAccount': 'ليس لديك حساب؟',
  'auth.haveAccount': 'لديك حساب بالفعل؟',
  'auth.chooseRole': 'أريد',
  'auth.role.customer': 'طلب الطعام',
  'auth.role.restaurant': 'البيع على كيو',
  'auth.acceptTerms': 'أوافق على',
  'auth.termsLink': 'شروط الاستخدام',
  'auth.privacyLink': 'سياسة الخصوصية',
  'auth.createAccount': 'إنشاء حساب',
  'auth.signingIn': 'جاري تسجيل الدخول…',
  'auth.signingUp': 'جاري الإنشاء…',
  'auth.sendingReset': 'إرسال الرابط…',
  'auth.backToLogin': 'العودة لتسجيل الدخول',
  'auth.checkEmailReset': 'تحقق من بريدك الوارد للحصول على رابط إعادة التعيين.',
  'auth.sessionRestoring': 'استعادة جلستك…',
  'auth.error.invalidCredentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'auth.error.emailTaken': 'يوجد حساب بهذا البريد الإلكتروني بالفعل.',
  'auth.error.weakPassword': 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.',
  'auth.error.tooManyAttempts': 'محاولات كثيرة جدًا. انتظر ثم أعد المحاولة.',
  'auth.error.network': 'مشكلة في الشبكة. تحقق من اتصالك.',
  'auth.error.timeout': 'يستغرق الأمر وقتًا أطول من المتوقع. أعد المحاولة.',
  'auth.error.unknown': 'حدث خطأ ما. حاول مرة أخرى.',
  'auth.error.passwordMismatch': 'كلمتا المرور غير متطابقتين.',
  'auth.error.acceptTerms': 'يرجى قبول الشروط وسياسة الخصوصية.',
  'auth.error.invalidEmail': 'يرجى إدخال بريد إلكتروني صالح.',
  'auth.error.invalidPhone': 'أدخل رقم هاتف جزائري صالح يبدأ بـ 05 أو 06 أو 07 أو +213.',
  'auth.error.emailDelivery': 'تعذر على كيو فود إرسال رسالة إعادة تعيين كلمة المرور. خدمة البريد غير متاحة مؤقتًا؛ حاول لاحقًا أو تواصل مع الدعم.',
  'auth.error.emailNotConfirmed': 'أكد بريدك الإلكتروني قبل تسجيل الدخول. تحقق من بريدك للعثور على رسالة تأكيد كيو فود.',
  'auth.error.popupBlocked': 'اسمح بالنوافذ المنبثقة لكيو فود للمتابعة مع مزود تسجيل الدخول هذا.',
  'auth.error.providerNotEnabled': 'مزود تسجيل الدخول هذا غير مفعّل بعد. اطلب من المدير تفعيله في Supabase → Authentication → Providers.',
  'auth.error.invalidRedirect': 'مزود تسجيل الدخول رفض إعادة التوجيه. يجب على المدير إضافة عنوان رد الاتصال لـ Supabase في لوحة المزود (راجع دليل الإعداد).',
  'auth.signupCheckEmailTitle': 'أكد بريدك الإلكتروني',
  'auth.signupCheckEmailBody': 'تم إنشاء حسابك. افتح رسالة التأكيد من كيو فود، ثم عد لتسجيل الدخول.',
  'auth.resetInvalidTitle': 'انتهت صلاحية رابط إعادة التعيين',
  'auth.resetInvalidBody': 'اطلب رابط إعادة تعيين جديد. لأسباب أمنية قد تنتهي صلاحية الروابط أو تُستخدم مرة واحدة فقط.',
  'auth.restaurantAccessTitle': 'يتم التحقق من حسابات المطاعم بعد التسجيل.',
  'auth.restaurantAccessBody': 'أنشئ حساب عميل أولاً. يتم منح صلاحية مالك المطعم عبر الإعداد وموافقة الإدارة، حتى لا يمكن إساءة استخدام التسجيل العام لاختيار دور داخلي.',
  'nav.home': 'الرئيسية',
  'nav.dashboard': 'لوحة التحكم',
  'nav.favorites': 'المفضلة',
  'nav.profile': 'الملف الشخصي',
  'nav.settings': 'الإعدادات',
  'nav.auditLogs': 'سجل التدقيق',
  'nav.users': 'المستخدمون',
  'nav.restaurants': 'المطاعم',
  'nav.orders': 'الطلبات',
  'dash.welcome': 'مرحبًا بعودتك',
  'dash.role': 'دورك',
  'dash.customer.title': 'حسابك',
  'dash.customer.subtitle': 'جائع؟ تصفح المطاعم القريبة منك.',
  'dash.restaurant.title': 'لوحة تحكم المطعم',
  'dash.restaurant.subtitle': 'إدارة قائمتك والطلبات الواردة.',
  'dash.admin.title': 'التحكم بالمنصة',
  'dash.admin.subtitle': 'رؤية كاملة لعمليات كيو.',
  'dash.comingSoon': 'سيتم بناء هذه المنطقة في المرحلة القادمة.',
  'dash.accountInfo': 'معلومات الحساب',
  'dash.totalOrders': 'إجمالي الطلبات',
  'dash.totalRestaurants': 'المطاعم',
  'dash.totalUsers': 'المستخدمون',
  'dash.recentActivity': 'النشاط الأخير',
  'error.genericTitle': 'حدث خطأ',
  'error.genericBody': 'حدث خطأ غير متوقع. أعد المحاولة أو أعد تحميل الصفحة.',
  'error.retry': 'إعادة المحاولة',
  'error.reload': 'إعادة التحميل',
  'error.pageNotFound': 'الصفحة غير موجودة',
  'error.pageNotFoundBody': 'الصفحة التي تبحث عنها غير موجودة أو تم نقلها.',
  'error.goHome': 'العودة للرئيسية',
  'error.unauthorizedTitle': 'يرجى تسجيل الدخول',
  'error.unauthorizedBody': 'يجب تسجيل الدخول لعرض هذه الصفحة.',
  'error.forbiddenTitle': 'تم رفض الوصول',
  'error.forbiddenBody': 'ليس لديك إذن لعرض هذه الصفحة.',
  'common.loading': 'جاري التحميل…',
  'common.cancel': 'إلغاء',
  'common.save': 'حفظ',
  'common.edit': 'تعديل',
  'common.back': 'رجوع',
  'common.close': 'إغلاق',
  'common.search': 'بحث',
  'common.none': '—',
  'common.refunds': 'الاسترداد',
  'common.cookies': 'ملفات تعريف الارتباط',
  'audit.title': 'سجل التدقيق',
  'audit.actor': 'الفاعل',
  'audit.action': 'الإجراء',
  'audit.target': 'الهدف',
  'audit.time': 'الوقت',
  'audit.empty': 'لا يوجد نشاط مسجل بعد.',
  'market.browse': 'تصفح المطاعم',
  'market.openNow': 'مفتوح الآن',
  'market.freeDelivery': 'توصيل مجاني',
  'market.topRated': 'الأعلى تقييماً',
  'market.empty': 'لا مطاعم قريبة منك بعد.',
  'market.searchPlaceholder': 'ابحث عن مطاعم أو مطابخ…',
  'market.nearMe': 'بالقرب مني',
  'market.locationTooWeak': 'دقة موقعك غير كافية لترتيب المطاعم بأمان. أعد المحاولة في مكان مفتوح.',
  'restaurant.menu': 'القائمة',
  'restaurant.owner': 'المالك',
  'restaurant.addToCart': 'أضف للسلة',
  'restaurant.closed': 'مغلق',
  'restaurant.open': 'مفتوح',
  'restaurant.busy': 'مشغول',
  'restaurant.reviews': 'تقييمات',
  'restaurant.about': 'حول',
  'restaurant.noMenu': 'لم يُنشر القائمة بعد.',
  'restaurant.addCategory': 'إضافة فئة',
  'restaurant.addItem': 'إضافة طبق',
  'restaurant.editItem': 'تعديل',
  'restaurant.newItem': 'طبق جديد',
  'restaurant.onboard': 'افتح مطعمك',
  'restaurant.onboard.prompt': 'سجّل مطعمك على كيو بدقائق.',
  'restaurant.onboard.existingOwnerHelp': '(مالك مطعم حالي)',
  'restaurant.onboard.noOwners': 'لا توجد حسابات لمالكي المطاعم بعد. اطلب من المالك التسجيل أولاً (سيختار "البيع على كيو" في نموذج التسجيل)، ثم عد إلى هنا لإنشاء مطعمه.',
  'restaurant.onboard.invalidName': 'يجب أن يحتوي اسم المطعم على حرفين على الأقل.',
  'restaurant.onboard.ownerRequired': 'اختر مالك مطعم موثّق قبل إنشاء المطعم.',
  'restaurant.onboard.locationTitle': 'موقع المطعم',
  'restaurant.onboard.locationHelp': 'استخدم GPS أو ضع الدبوس بدقة على مدخل المطعم قبل النشر.',
  'restaurant.onboard.coordinatesSaved': 'تم حفظ الإحداثيات',
  'restaurant.onboard.pendingNotice': 'يتم إنشاؤه كـ "قيد المراجعة". قم بمراجعته ونشره من صفحة إدارة المطاعم.',
  'restaurant.phone': 'الهاتف',
  'restaurant.address': 'العنوان',
  'restaurant.cuisine': 'نوع المطبخ (افصل بفاصلة)',
  'restaurant.image': 'رابط الصورة',
  'restaurant.create': 'إنشاء المطعم',
  'restaurant.creating': 'جاري الإنشاء…',
  'restaurant.openRestaurant': 'افتح مطعماً',
  'restaurant.available': 'متوفر',
  'restaurant.outOfStock': 'نفد',
  'restaurant.price': 'السعر (دج)',
  'restaurant.categoryName': 'اسم الفئة',
  'restaurant.itemName': 'اسم الطبق',
  'restaurant.description': 'الوصف',
  'restaurant.delete': 'حذف',
  'restaurant.dashboard': 'لوحة المطعم',
  'restaurant.manageMenu': 'إدارة القائمة',
  'restaurant.waitingOrders': 'الطلبات الواردة',
  'restaurant.noOrders': 'لا توجد طلبات جديدة.',
  'restaurant.apply.nav': 'طلب الانضمام كمطعم',
  'restaurant.apply.title': 'طلب مطعم',
  'restaurant.apply.subtitle': 'أرسل بيانات مطعمك للمراجعة. سيبقى قيد الانتظار حتى توافق كيو فود عليه.',
  'restaurant.apply.name': 'اسم المطعم',
  'restaurant.apply.legalName': 'الاسم القانوني للنشاط',
  'restaurant.apply.openingHours': 'ساعات العمل',
  'restaurant.apply.openingHoursPlaceholder': 'مثال: من الأحد إلى الخميس 11:00-23:00، الجمعة 15:00-23:30',
  'restaurant.apply.logo': 'شعار المطعم',
  'restaurant.apply.cover': 'صورة غلاف المطعم',
  'restaurant.apply.submit': 'إرسال الطلب',
  'restaurant.apply.submitting': 'جارٍ الإرسال...',
  'restaurant.apply.successTitle': 'تم إرسال الطلب',
  'restaurant.apply.successBody': 'مطعمك الآن قيد المراجعة. ستوافق كيو فود عليه أو ترسل سبب رفض واضحاً لتعديله وإعادة إرساله.',
  'restaurant.apply.errorName': 'أدخل اسم مطعم صالحاً.',
  'restaurant.apply.errorPhone': 'أدخل رقم هاتف صالحاً للمطعم.',
  'restaurant.apply.errorAddress': 'أدخل عنوان مطعم صالحاً.',
  'restaurant.apply.errorLocation': 'حدد موقع المطعم على الخريطة.',
  'restaurant.apply.errorDelivery': 'أدخل نطاق توصيل بين 1 و100 كم.',
  'restaurant.apply.errorMinOrder': 'لا يمكن أن يكون الحد الأدنى للطلب سالباً.',
  'map.searchPlaceholder': 'ابحث عن عنوان أو حي أو مدينة...',
  'map.useCurrentLocation': 'استخدام موقعي الحالي',
  'map.locating': 'جارٍ تحديد الموقع...',
  'map.gps': 'GPS',
  'map.searching': 'جارٍ البحث عن العناوين...',
  'map.loading': 'جارٍ تحميل الخريطة...',
  'map.locationUnavailable': 'الموقع غير متاح. يمكنك البحث عن عنوان أو الضغط على الخريطة لاختيار نقطة التوصيل.',
  'map.locationOutsideAlgeria': 'هذا الموقع خارج الجزائر. ابحث عن عنوان أو ضع الدبوس داخل منطقة الخدمة.',
  'map.gpsWeak': 'دقة GPS ضعيفة. تم وضع الدبوس، لكن يرجى تأكيده أو سحبه إلى المدخل الصحيح.',
  'map.gpsApproximate': 'موقع GPS تقريبي. تم وضع الدبوس، لكن اسحبه إلى المدخل الصحيح قبل الإرسال.',
  'map.improvingAccuracy': 'جارٍ تحسين دقة GPS...',
  'map.restaurantConfirmRequired': 'يجب أن يكون موقع المطعم دقيقاً. اسحب الدبوس إلى المدخل ثم أكده.',
  'map.confirmWeakGps': 'ما زالت دقة GPS ضعيفة. اسحب الدبوس إلى المدخل الصحيح وأكده قبل الحفظ.',
  'map.confirmDraggedPin': 'أكد هذا الدبوس الدقيق قبل الحفظ.',
  'map.confirmSearchPin': 'وجد البحث هذه المنطقة. حرك الدبوس إذا لزم الأمر ثم أكد الموقع الدقيق.',
  'map.pinConfirmed': 'تم تأكيد الدبوس',
  'map.pinNeedsConfirmation': 'يحتاج الدبوس إلى تأكيد',
  'map.confirmPin': 'تأكيد الدبوس الدقيق',
  'map.confirmRequired': 'أكد الدبوس الدقيق على الخريطة قبل المتابعة.',
  'map.tileFallbackActive': 'تم تشغيل مصدر احتياطي للخريطة لأن تحميل الخريطة الأساسي بطيء.',
  'map.tileReconnecting': 'الخريطة تعيد الاتصال. الدبوس الذي اخترته محفوظ.',
  'map.distance': 'المسافة',
  'map.max': 'الحد الأقصى',
  'map.gpsAccuracy': 'دقة GPS',
  'map.heading': 'الاتجاه',
  'map.outsideZone': 'هذا العنوان خارج نطاق توصيل المطعم',
  'map.locationDeliveryZone': 'الموقع ونطاق التوصيل',
  'map.locationUnavailableShort': 'موقع هذا المطعم غير متاح.',
  'map.trackingRiderEnRoute': 'السائق في الطريق',
  'map.trackingPreparing': 'الطلب قيد التحضير',
  'map.trackingLive': 'الطلب مباشر',
  'map.driverWeakGps': 'دقة GPS ضعيفة. اقترب من نافذة أو مكان مفتوح.',
  'map.driverJump': 'تم رصد قفزة غير طبيعية في الموقع. أبقِ GPS مفعلاً لتوصيل موثوق.',
  'map.driverSyncFailed': 'تعذرت مزامنة GPS المباشرة. أبقِ هذه الصفحة مفتوحة وتحقق من إذن الموقع.',
  'map.driverPermissionRequired': 'إذن الموقع مطلوب أثناء الاتصال.',
  'map.searchUnavailable': 'البحث عن العناوين غير متاح مؤقتاً. يمكنك تحريك الخريطة لاختيار النقطة الدقيقة.',
  'map.addressStillLoading': 'خدمة العناوين ما زالت قيد التحميل. انتظر قليلاً ثم أعد المحاولة.',
  'map.addressNotFound': 'لم يتم العثور على عنوان شارع دقيق هنا. حرّك الخريطة إلى المدخل الصحيح ثم أكد العلامة.',
  'map.addressApproximate': 'هذه النتيجة تحدد منطقة وليست مدخلاً دقيقاً. حرّك الخريطة إلى النقطة الصحيحة قبل التأكيد.',
  'map.locationSelector': 'اختيار موقع دقيق',
  'map.restaurantMarker': 'موقع المطعم',
  'map.currentPosition': 'موقع GPS الحالي',
  'map.satelliteView': 'عرض صور الأقمار الصناعية',
  'map.standardView': 'عرض الخريطة العادية',
  'map.releaseToSelect': 'اترك الخريطة لاختيار هذه النقطة',
  'map.outsideZoneShort': 'خارج نطاق التوصيل',
  'map.movePinRequired': 'حرّك الخريطة إلى النقطة الدقيقة',
  'map.selectionHelp': 'ابحث عن عنوان أو استخدم موقعك الحالي أو حرّك الخريطة إلى المدخل الدقيق.',
  'map.permissionDenied': 'لم تتم الموافقة على طلب الموقع. تحقق من إذن الموقع لهذا الموقع ومن خدمات الموقع في الجهاز، ثم أعد المحاولة أو أدخل العنوان يدوياً.',
  'map.iosLocationRequestFailed': 'لم يتمكن Safari من السماح بطلب الموقع. من إعدادات iPhone افتح الخصوصية والأمان ثم خدمات الموقع ثم مواقع Safari وفعّل الموقع الدقيق، أو أدخل العنوان يدوياً.',
  'map.positionUnavailable': 'قد يكون الإذن مفعلاً، لكن الجهاز لم يتمكن من تحديد الموقع. فعّل خدمات الموقع وانتقل إلى مكان مفتوح ثم أعد المحاولة أو أدخل العنوان يدوياً.',
  'map.locationUnsupported': 'هذا المتصفح لا يوفر الموقع. ابحث عن العنوان أو اختر النقطة يدوياً.',
  'map.locationTimeout': 'تأخر GPS في الاستجابة. انتقل إلى مكان مفتوح وأعد المحاولة أو اختر النقطة يدوياً.',
  'map.confirmGpsPin': 'حدد GPS هذه النقطة. تحقق من المدخل على الخريطة ثم أكد الدبوس.',
  'map.loadFailedTitle': 'تعذر تحميل الخريطة',
  'map.loadFailedBody': 'تحقق من الاتصال ثم أعد المحاولة. لم يتم فقدان بيانات النموذج.',
  'map.configurationMissingTitle': 'خدمة الخرائط غير متاحة',
  'map.configurationMissingBody': 'اختيار الموقع غير متاح مؤقتاً. أعد المحاولة بعد قليل.',
  'map.customerMarker': 'موقع التوصيل',
  'map.driverMarker': 'موقع السائق',
  'map.coverageTitle': 'خريطة نشاط التوصيل',
  'map.coverageFilter': 'تصفية نشاط الخريطة',
  'map.coverageAll': 'كل النشاط',
  'map.coverageDestinations': 'وجهات التوصيل',
  'map.coverageRestaurants': 'المطاعم',
  'map.coverageAnalyzing': 'جارٍ تحليل نشاط المواقع...',
  'map.coverageEmpty': 'لا توجد بيانات مواقع مؤكدة تطابق هذا التصفية بعد.',
  'map.coverageSummary': 'نقطة موقع مؤكدة معروضة لتخطيط التغطية التشغيلية.',
  'map.coverageLoadFailed': 'تعذر تحميل نشاط المواقع. تحقق من صلاحيات المالك ثم أعد المحاولة.',
  'map.gpsLive': 'مباشر',
  'map.gpsIdle': 'في الانتظار',
  'map.gpsError': 'غير متاح',
  'map.offlineTitle': 'أنت غير متصل بالإنترنت',
  'map.offlineBody': 'أعد الاتصال لتحميل الخريطة. ما زال العنوان المختار وبيانات النموذج محفوظين.',
  'map.recenter': 'إعادة التمركز على موقعي',
  'map.weakConnection': 'الاتصال ضعيف — قد تتأخر بعض ميزات الخريطة قليلاً.',
  'map.tilesSlow': 'يتم تحميل الخريطة عبر اتصال بطيء. موقعك الأخير متاح بينما نواصل المحاولة.',
  'map.gpsWeakMeasured': 'لم يتمكن GPS من تحديد موقعك إلا بدقة تقارب',
  'map.gpsWeakAction': 'أعد المحاولة في مكان مفتوح أو أدخل العنوان يدوياً؛ لم يتم اختيار هذه القراءة.',
  'map.retryGps': 'إعادة محاولة GPS',
  'map.enterManually': 'إدخال العنوان يدوياً',
  'map.outsideBy': 'خارج نطاق التوصيل هذا',
  'map.findAvailableRestaurants': 'عرض المطاعم التي توصل إلى هنا',
  'map.zoomIn': 'تكبير الخريطة',
  'map.zoomOut': 'تصغير الخريطة',
  'map.accuracy.excellent': 'ممتازة',
  'map.accuracy.good': 'جيدة',
  'map.accuracy.acceptable': 'تحتاج إلى تأكيد',
  'map.accuracy.weak': 'ضعيفة',
  'map.accuracy.unknown': 'غير معروفة',
  'location.deliverTo': 'التوصيل إلى',
  'location.chooseExact': 'اختر موقعاً دقيقاً',
  'location.title': 'إلى أين تريد التوصيل؟',
  'location.privacy': 'ابحث أو استخدم GPS ثم أكد المدخل الدقيق على الخريطة.',
  'location.saved': 'العناوين المحفوظة والأخيرة',
  'location.noSaved': 'لا توجد عناوين محفوظة. اختر نقطة دقيقة على الخريطة.',
  'location.privacyShort': 'يُستخدم موقعك الدقيق فقط للتحقق من إمكانية التوصيل وإيصال طلبك.',
  'location.landmark': 'معلم قريب',
  'location.instructions': 'تعليمات للسائق',
  'location.webAccuracyNotice': 'للحصول على أفضل دقة، ابحث عن عنوانك أو ضع الدبوس يدويًا على الخريطة بدل الاعتماد على GPS وحده. سيوفر تطبيقنا القادم تحديدًا أدق للموقع بشكل ملحوظ.',
  'location.dismissAccuracyNotice': 'إغلاق معلومات دقة الموقع',
  'location.notConfirmed': 'لم يتم تأكيد نقطة توصيل دقيقة',
  'location.ready': 'الإحداثيات الدقيقة جاهزة للتوصيل.',
  'location.confirmOnMap': 'أكد الدبوس على الخريطة قبل المتابعة.',
  'location.confirmDelivery': 'تأكيد موقع التوصيل',
  'location.customLabel': 'اسم العنوان (اختياري)',
  'location.quoteSummary': 'مسافة التوصيل المؤكدة',
  'location.etaMinutes': 'الوصول المتوقع (بالدقائق)',
  'location.useSaved': 'استخدام عنوان محفوظ',
  'location.defaultAddress': 'الافتراضي',
  'location.differentLocation': 'التوصيل إلى موقع آخر',
  'location.recent': 'موقع حديث',
  'location.recentNeedsConfirmation': 'راجع هذه النقطة الحديثة على الخريطة قبل تأكيدها.',
  'location.confirmedSuccess': 'تم تأكيد الموقع',
  'location.restaurantsDeliverHere': 'مطاعم توصل إلى هذا الموقع',
  'location.restaurantDeliversHere': 'مطعم يوصل إلى هذا الموقع',
  'location.etaRange': 'مدة التوصيل المتوقعة',
  'location.minutesShort': 'د',
  'location.savePrompt': 'هل تريد حفظ هذا العنوان كمنزل أو عمل لتسريع الطلب في المرة القادمة؟',
  'location.saveAsHome': 'حفظ كمنزل',
  'location.saveAsWork': 'حفظ كعمل',
  'location.notNow': 'ليس الآن',
  'cart.title': 'سلتك',
  'cart.empty': 'سلتك فارغة',
  'cart.emptyBody': 'تصفح المطاعم وأضف أطباقاً.',
  'cart.subtotal': 'المجموع الفرعي',
  'cart.deliveryFee': 'رسوم التوصيل',
  'cart.serviceFee': 'رسوم الخدمة',
  'cart.total': 'الإجمالي',
  'cart.checkout': 'إتمام الطلب',
  'cart.removeItem': 'إزالة',
  'cart.clear': 'تفريغ السلة',
  'cart.switchWarning': 'إضافة أطباق من مطعم آخر ستستبدل سلتك الحالية.',
  'checkout.step.cart': 'السلة',
  'checkout.step.details': 'التوصيل',
  'checkout.step.confirm': 'تأكيد',
  'checkout.fullName': 'الاسم الكامل',
  'checkout.phone': 'رقم الهاتف',
  'checkout.contactQuestion': 'ما رقم الهاتف الذي يجب أن يستخدمه المطعم أو السائق لهذا الطلب؟',
  'checkout.useAccountPhone': 'استخدام رقم هاتف حسابي',
  'checkout.useDifferentPhone': 'استخدام رقم مختلف لهذا الطلب',
  'checkout.accountPhoneMissing': 'لا يوجد رقم هاتف محفوظ في هذا الحساب',
  'checkout.alternatePhoneLabel': 'رقم الهاتف لهذا الطلب',
  'checkout.address': 'عنوان التوصيل',
  'checkout.notes': 'ملاحظات',
  'checkout.notesPlaceholder': 'مثلاً: بدون بصل، حار جداً',
  'checkout.placeOrder': 'تأكيد الطلب',
  'checkout.placing': 'جاري الإرسال…',
  'checkout.delivery': 'التوصيل',
  'checkout.placeOrderSummary': 'تُحتسب الرسوم حسب المسافة. كيو يحدد المبلغ.',
  'checkout.success': 'تم الطلب!',
  'checkout.successBody': 'تم إرسال طلبك إلى المطعم.',
  'checkout.deliveryByRestaurant': 'يتم إدارة التوصيل مباشرة من قبل المطعم.',
  'checkout.viewOrders': 'عرض طلباتي',
  'checkout.backToCart': 'للسلة',
  'checkout.backToDetails': 'للتفاصيل',
  'checkout.idle': 'جاهز للإرسال',
  'checkout.empty': 'سلتك فارغة.',
  'checkout.noRestaurant': 'لم تختر مطعماً.',
  'checkout.error': 'تعذّر إرسال الطلب. حاول مجدداً.',
  'checkout.errorCalc': 'تعذّر حساب الرسوم. أعد المحاولة.',
  'checkout.deliveryPlaceholder': 'الشارع، المبنى، الطابق…',
  'checkout.invalidPhone': 'أدخل رقم هاتف صالح.',
  'checkout.invalidAddress': 'أدخل عنوان التوصيل.',
  'orders.title': 'طلباتك',
  'orders.id': 'طلب',
  'orders.items': 'عناصر',
  'orders.status': 'الحالة',
  'orders.empty': 'لا توجد طلبات بعد.',
  'orders.total': 'الإجمالي',
  'orders.placed': 'بتاريخ',
  'orders.track': 'تتبع',
  'orders.reorder': 'إعادة الطلب',
  'status.pending': 'قيد الانتظار',
  'status.accepted': 'مقبول',
  'status.preparing': 'قيد التحضير',
  'status.out_for_delivery': 'في الطريق',
  'status.delivered': 'تم التوصيل',
  'status.cancelled': 'ملغى',
  'status.accept': 'قبول',
  'status.reject': 'رفض',
  'status.startPreparing': 'بدء التحضير',
  'status.markOutForDelivery': 'في الطريق',
  'status.markDelivered': 'تم التوصيل',
  'status.cancelOrder': 'إلغاء',
  'status.failed_delivery': 'فشل التوصيل',
  'status.markFailedDelivery': 'تحديد فشل',
  'status.refunded': 'مسترد',
  'admin.restaurantsManagement': 'المطاعم',
  'admin.approve': 'موافقة',
  'admin.reject': 'رفض',
  'admin.pendingApproval': 'بانتظار الموافقة',
  'admin.noPending': 'لا توجد مطاعم بانتظار الموافقة.',
  'wilaya.select': 'اختر الولاية',
  'wilaya.searchPlaceholder': 'ابحث عن ولاية…',
  'wilaya.detectLocation': 'تحديد موقعي',
  'wilaya.detecting': 'جاري التحديد…',
  'wilaya.noResults': 'لم تُوجد ولاية.',
  'wilaya.detectError': 'تعذر تحديد ولايتك بشكل موثوق. يرجى اختيارها يدوياً.',
  'wilaya.permissionDenied': 'إذن الموقع محظور. اسمح به من إعدادات المتصفح أو اختر ولايتك يدوياً.',
  'wilaya.locationTooWeak': 'دقة موقعك غير كافية لاختيار الولاية بأمان. يرجى اختيارها يدوياً.',
  'nav.controlCenter': 'مركز التحكم',
  'nav.driverDashboard': 'لوحة تحكم السائق',
  'nav.support': 'الدعم الفني',
  'role.super_admin': 'مدير النظام',
  'role.restaurant_owner': 'مالك مطعم',
  'role.customer': 'عميل',
  'role.driver': 'سائق توصيل',
  'sys.underMaintenance': 'قيد الصيانة',
  'sys.maintenanceDesc': 'نحن نقوم بصيانة دورية مجدولة. يرجى العودة لاحقاً.',
  'admin.controlCenter': 'مركز التحكم',
  'admin.fullVisibility': 'رؤية كاملة وإدارة للمنصة',
  'admin.financialsDesc': 'المالية، المستخدمين، المطاعم، القوانين، التحليلات',
  // support
  'support.title': 'الدعم الفني',
  'support.subtitle': 'احصل على المساعدة في الطلبات أو الدفع أو الحساب',
  'support.newTicket': 'تذكرة جديدة',
  'support.noTickets': 'لا توجد تذاكر دعم بعد',
  'support.needHelp': 'هل تحتاج إلى مساعدة؟ أنشئ تذكرة أعلاه.',
  'support.prioritySuffix': 'أولوية',
  'support.form.subject': 'الموضوع',
  'support.form.subjectPlaceholder': 'وصف موجز لمشكلتك',
  'support.form.category': 'الفئة',
  'support.form.priority': 'الأولوية',
  'support.form.orderIdOptional': 'رقم الطلب (اختياري)',
  'support.form.orderIdPlaceholder': 'أدخل رقم الطلب إذا كان الأمر يتعلق بطلب معين',
  'support.form.description': 'الوصف',
  'support.form.descriptionPlaceholder': 'يرجى وصف المشكلة بالتفصيل...',
  'support.form.submit': 'إرسال التذكرة',
  'support.form.validation': 'يرجى ملء الموضوع والوصف',
  'support.backToTickets': 'العودة إلى التذاكر',
  'support.conversation': 'المحادثة',
  'support.noMessages': 'لا توجد رسائل بعد. ابدأ المحادثة أدناه.',
  'support.typeReply': 'اكتب ردك هنا...',
  'support.category.general': 'عام',
  'support.category.bug': 'مشكلة تقنية',
  'support.category.abuse': 'إبلاغ عن إساءة',
  'support.category.complaint': 'شكوى',
  'support.category.billing': 'الفواتير والدفع',
  'support.category.other': 'آخر',
  'support.priority.low': 'منخفضة',
  'support.priority.normal': 'عادية',
  'support.priority.high': 'عالية',
  'support.priority.urgent': 'عاجلة',
  'support.you': 'أنت',
  'support.staff': 'الدعم الفني',
  // profile & privacy
  'profile.loyalty.title': 'برنامج الولاء',
  'profile.loyalty.subtitle': 'اكسب نقطة واحدة مقابل كل 100 دج تنفقها',
  'profile.loyalty.currentPoints': 'النقاط الحالية',
  'profile.loyalty.lifetimePoints': 'إجمالي النقاط',
  'profile.loyalty.nextTier': 'المستوى التالي',
  'profile.loyalty.maxTier': 'تم الوصول إلى الحد الأقصى للمستوى!',
  'profile.phone': 'الهاتف',
  'profile.language': 'اللغة',
  'profile.addresses.title': 'العناوين المحفوظة',
  'profile.addresses.addNew': 'إضافة جديد',
  'profile.addresses.label': 'التسمية',
  'profile.addresses.home': 'المنزل',
  'profile.addresses.work': 'العمل',
  'profile.addresses.family': 'العائلة',
  'profile.addresses.other': 'أخرى',
  'profile.addresses.default': 'الافتراضي',
  'profile.addresses.setAsDefault': 'تعيين كافتراضي',
  'profile.addresses.favorite': 'المفضلة',
  'profile.addresses.duplicate': 'نسخ',
  'profile.addresses.archive': 'أرشفة',
  'profile.addresses.delete': 'حذف',
  'profile.addresses.none': 'لا توجد عناوين محفوظة بعد. أضف منزلك أو عملك أو أماكن التوصيل المفضلة.',
  'profile.addresses.signinToManage': 'سجل الدخول لإدارة عناوينك المحفوظة.',
  'profile.addresses.save': 'حفظ العنوان',
  'profile.privacy.title': 'الخصوصية والبيانات',
  'profile.privacy.subtitle': 'بياناتك تحت تحكمك الكامل. يمكنك تصدير بياناتك أو حذفها وفقاً لسياسة حذف الحساب الخاصة بنا.',
  'profile.privacy.export': 'تصدير بياناتي',
  'profile.privacy.exportDesc': 'تحميل بصيغة JSON',
  'profile.privacy.delete': 'حذف حسابي',
  'profile.privacy.deleteDesc': 'نهائي بعد 14 يوماً',
  'profile.privacy.exportSuccess': 'تم تحميل البيانات المصدرة.',
  'profile.privacy.exportFailed': 'فشل تصدير البيانات. يرجى المحاولة مرة أخرى.',
  'profile.privacy.policy': 'سياسة الخصوصية',
  'profile.privacy.cookie': 'سياسة ملفات تعريف الارتباط',
  'profile.privacy.refund': 'سياسة الاسترداد والإلغاء',
  // deletion modal
  'profile.deleteModal.title': 'حذف الحساب',
  'profile.deleteModal.body1': 'سيؤدي هذا إلى تسجيل خروجك فوراً وقفل حسابك. سيتم حذف ملفك الشخصي ومفضلتك وبياناتك المحفوظة في غضون 14 يوماً.',
  'profile.deleteModal.body2': 'يتم الاحتفاظ بملفات الطلبات والسجلات المالية لمدة 7 سنوات بموجب القانون الضريبي - ولكن سيتم إخفاء هويتك ولن تعد مرتبطة بملفاتك الشخصية.',
  'profile.deleteModal.warn': 'لا يمكن لحسابات مالكي المطاعم النشطة حذف الحساب بأنفسهم. يرجى الاتصال بالدعم الفني بدلاً من ذلك.',
  'profile.deleteModal.confirmText': 'اكتب DELETE للتأكيد',
  'profile.deleteModal.deleteForever': 'حذف نهائي',
  'profile.deleteModal.deleting': 'جاري الحذف…',
  // driver dashboard & onboarding
  'driver.dashboard': 'لوحة تحكم السائق',
  'driver.activeDelivery': 'التوصيل النشط',
  'driver.waitingRequests': 'بانتظار طلبات توصيل جديدة...',
  'driver.goOnlineDesc': 'قم بتفعيل الاتصال لبدء تلقي طلبات التوصيل',
  'driver.onboarding.title': 'كن سائق توصيل معنا',
  'driver.onboarding.subtitle': 'أكمل طلبك لبدء الكسب مع كيو فود',
  'driver.onboarding.successTitle': 'تم تقديم الطلب بنجاح!',
  'driver.onboarding.successBody': 'طلب السائق الخاص بك قيد المراجعة حالياً. سنقوم بإشعارك فور الموافقة.',
  'driver.onboarding.redirecting': 'جاري الانتقال إلى لوحة التحكم...',
  'driver.onboarding.step1Title': 'اختر نوع مركبتك',
  'driver.onboarding.step2Title': 'تفاصيل المركبة',
  'driver.onboarding.step3Title': 'معلومات الاتصال',
  'driver.onboarding.licensePlate': 'رقم لوحة المركبة',
  'driver.onboarding.licenseNumber': 'رقم رخصة القيادة',
  'driver.onboarding.idNumber': 'رقم الهوية الوطنية',
  'driver.onboarding.uploadDocs': 'تحميل الوثائق',
  'driver.onboarding.uploadPrompt': 'تحميل الرخصة والهوية ووثائق المركبة',
  'driver.onboarding.uploadFormat': 'PNG، JPG أو PDF',
  'driver.onboarding.phonePrompt': 'سنستخدم هذا الرقم للاتصال بك بشأن عمليات التوصيل',
  'driver.onboarding.appSummary': 'ملخص الطلب',
  // reset password
  'auth.resetPasswordSuccess': 'تمت إعادة تعيين كلمة المرور بنجاح!',
  'auth.resetPasswordSuccessBody': 'تم تحديث كلمة المرور الخاصة بك بنجاح.',
  'auth.newPassword': 'كلمة المرور الجديدة',
  'auth.newPasswordPrompt': 'أدخل كلمة المرور الجديدة أدناه.',
  'auth.updating': 'جاري التحديث...',
  'auth.savePassword': 'حفظ كلمة المرور',
  // restaurant settings
  'restaurant.settings.title': 'إعدادات المطعم',
  'restaurant.settings.businessHours': 'ساعات العمل',
  'restaurant.settings.hoursDesc': 'قم بتعيين أوقات الفتح والإغلاق لكل يوم. اترك اليوم غير محدد لتمييزه كمغلق.',
  'restaurant.settings.deliveryConfig': 'إعدادات التوصيل',
  'restaurant.settings.maxRadius': 'نطاق التوصيل الأقصى (كم)',
  'restaurant.settings.maxRadiusDesc': 'لن يتمكن العملاء خارج هذا النطاق من الطلب من مطعمك.',
  'restaurant.settings.minOrder': 'الحد الأدنى لقيمة الطلب (دج)',
  'restaurant.settings.minOrderDesc': 'سيتم رفض الطلبات التي تقل قيمتها عن هذا المبلغ.',
  'restaurant.settings.estTime': 'وقت التوصيل المقدر (بالدقائق)',
  'restaurant.settings.estTimeDesc': 'يتم عرض هذا للعملاء قبل تقديم الطلب.',
  'restaurant.settings.opStatus': 'الحالة التشغيلية',
  'restaurant.settings.opStatusDesc': 'مفتوح: استقبال الطلبات بشكل عادي. مزدحم: وقت تحضير أطول. مغلق: لا يستقبل طلبات.',
  'restaurant.settings.saving': 'جاري الحفظ...',
  'restaurant.settings.saveSettings': 'حفظ الإعدادات',
  'restaurant.settings.saved': 'تم حفظ الإعدادات!',
  'restaurant.settings.commissionRate': 'هامش الربح / معدل العمولة (%)',
  'restaurant.settings.commissionDesc': 'قم بتعيين النسبة المئوية لعمولة مطعمك. يتم تخزين هذا مباشرة في ملف تعريف مطعمك واستخدامه لحساب نسب توزيع أرباح المنصة.',
  'restaurant.settings.invalidCommissionRate': 'يرجى إدخال نسبة عمولة صالحة بين 0 و 100.',
  'restaurant.settings.financialTitle': 'الإعدادات المالية',
  'restaurant.dash.today': 'اليوم',
  'restaurant.dash.thisMonth': 'هذا الشهر',
  'restaurant.dash.commissionOwed': 'العمولة المستحقة',
  'restaurant.dash.netPayout': 'صافي الأرباح',
  'restaurant.dash.soundOn': 'الصوت مفعل',
  'restaurant.dash.soundOff': 'الصوت مغلق',
  'restaurant.dash.activeOrders': 'الطلبات النشطة',
  'restaurant.dash.completed': 'المكتملة',
  'restaurant.dash.newOrderAlert': 'تم استقبال طلب جديد!',
  'favorites.subtitle': 'مطاعمك المفضلة',
  'favorites.none': 'لا توجد مطاعم مفضلة بعد',
  'orders.reviewed': 'تم التقييم',
  'orders.leaveReview': 'اترك تقييماً',
  'driver.onboard.title': 'كن سائقاً',
  'driver.onboard.subtitle': 'أكمل طلبك لبدء الكسب مع كيو فود',
  'driver.onboard.success.title': 'تم تقديم الطلب!',
  'driver.onboard.success.body': 'جاري مراجعة طلب السائق الخاص بك. سيتم إعلامك بمجرد الموافقة.',
  'driver.onboard.success.redirect': 'جاري إعادة التوجيه إلى لوحة التحكم...',
  'driver.onboard.step.vehicle': 'اختر مركبتك',
  'driver.onboard.step.details': 'تفاصيل المركبة',
  'driver.onboard.licensePlate': 'رقم لوحة المركبة',
  'driver.onboard.licenseNumber': 'رقم رخصة القيادة',
  'driver.onboard.idNumber': 'رقم الهوية الوطنية',
  'driver.onboard.uploadDocuments': 'تحميل الوثائق',
  'driver.onboard.uploadPrompt': 'تحميل الرخصة والهوية ووثائق المركبة',
  'driver.onboard.uploadFormat': 'PNG، JPG أو PDF',
  'driver.onboard.contactTitle': 'معلومات الاتصال',
  'driver.onboard.phone': 'رقم الهاتف',
  'driver.onboard.phoneHelp': 'سنستخدم هذا الرقم للاتصال بك بشأن عمليات التوصيل',
  'driver.onboard.summary': 'ملخص الطلب',
  'driver.onboard.vehicle': 'المركبة',
  'driver.onboard.plate': 'اللوحة',
  'driver.onboard.license': 'الرخصة',
  'driver.onboard.id': 'الهوية',
  'driver.onboard.documents': 'الوثائق',
  'driver.onboard.submit': 'تقديم الطلب',
  'driver.vehicle.bicycle': 'دراجة هوائية',
  'driver.vehicle.bicycle.desc': 'صديقة للبيئة للمسافات القصيرة',
  'driver.vehicle.motorcycle': 'دراجة نارية',
  'driver.vehicle.motorcycle.desc': 'توصيل سريع في المناطق الحضرية',
  'driver.vehicle.scooter': 'سكوتر',
  'driver.vehicle.scooter.desc': 'فعال لعمليات التوصيل داخل المدينة',
  'driver.vehicle.car': 'سيارة',
  'driver.vehicle.car.desc': 'مثالية للمسافات الأطول',
  'common.continue': 'متابعة',
  'common.to': 'إلى',
  'common.closed': 'مغلق',
  'day.0': 'الأحد',
  'day.1': 'الإثنين',
  'day.2': 'الثلاثاء',
  'day.3': 'الأربعاء',
  'day.4': 'الخميس',
  'day.5': 'الجمعة',
  'day.6': 'السبت',
  'driver.dash.pendingVerification': 'حسابك قيد المراجعة والتحقق. سيتم إشعارك فور الموافقة عليه.',
  'driver.dash.failedLoad': 'فشل تحميل ملف السائق',
  'driver.dash.onlineAccepting': 'نشط - استقبال طلبات التوصيل',
  'driver.dash.offline': 'غير نشط',
  'driver.dash.goOnline': 'تفعيل الاتصال',
  'driver.dash.online': 'نشط',
  'driver.dash.today': 'اليوم',
  'driver.dash.thisWeek': 'هذا الأسبوع',
  'driver.dash.pending': 'قيد الانتظار',
  'driver.dash.deliveries': 'عمليات التوصيل',
  'driver.dash.headingToRestaurant': 'التوجه إلى المطعم',
  'driver.dash.orderCollected': 'تم استلام الطلب',
  'driver.dash.enRouteToCustomer': 'جاري التوصيل للعميل',
  'driver.dash.arrived': 'وصلت',
  'driver.dash.markAsDelivered': 'تم التوصيل',
  'driver.dash.newRequest': 'طلب توصيل جديد',
  'driver.dash.pickup': 'الاستلام من',
  'driver.dash.deliverTo': 'التوصيل إلى',
  'driver.dash.accept': 'قبول',
  'driver.dash.decline': 'رفض',
  'driver.dash.title': 'لوحة تحكم السائق',
  'driver.dash.activeDelivery': 'التوصيل النشط',
  'driver.dash.waiting': 'بانتظار طلبات توصيل جديدة...',
  'driver.dash.goOnlineHelp': 'قم بتفعيل الاتصال لبدء استقبال طلبات التوصيل',
};

const dicts: Record<Locale, Dict> = { en, fr, ar };

export function translate(locale: Locale, key: TranslationKey): string {
  return dicts[locale][key] ?? dicts.en[key] ?? key;
}

export function isRtl(locale: Locale): boolean {
  return locale === 'ar';
}
