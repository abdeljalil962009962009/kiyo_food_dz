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
  | 'common.back'
  | 'common.close'
  | 'common.search'
  | 'common.none'
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
  | 'common.back'
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
  'common.back': 'Back',
  'common.close': 'Close',
  'common.search': 'Search',
  'common.none': '—',
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
  'common.back': 'Back',
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
  'common.back': 'Retour',
  'common.close': 'Fermer',
  'common.search': 'Rechercher',
  'common.none': '—',
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
  'common.back': 'Retour',
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
  'common.back': 'رجوع',
  'common.close': 'إغلاق',
  'common.search': 'بحث',
  'common.none': '—',
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
  'common.back': 'عودة',
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
