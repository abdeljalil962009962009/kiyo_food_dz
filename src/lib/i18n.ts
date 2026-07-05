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
  | 'wilaya.noResults';

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
};

const dicts: Record<Locale, Dict> = { en, fr, ar };

export function translate(locale: Locale, key: TranslationKey): string {
  return dicts[locale][key] ?? dicts.en[key] ?? key;
}

export function isRtl(locale: Locale): boolean {
  return locale === 'ar';
}
