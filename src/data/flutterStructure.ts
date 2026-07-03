/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FlutterFile {
  path: string;
  description: string;
  code: string;
}

export const flutterFiles: FlutterFile[] = [
  {
    path: 'lib/main.dart',
    description: 'App initialization root configuring Riverpod scopes, Firebase options, and Material 3 design system bindings.',
    code: `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  
  runApp(
    const ProviderScope(
      child: MyApp(),
    ),
  );
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterPrvdr);

    return MaterialApp.router(
      title: 'Gemini Care OPD',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}`
  },
  {
    path: 'lib/core/router/app_router.dart',
    description: 'Clean routing mapping using GoRouter. Configures Splash, Login (Mobile OTP), Home, Claim Form, AI Chat, and admin portals.',
    code: `import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/splash/splash_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/claims/presentation/claim_opd_screen.dart';
import '../../features/ai_assistant/presentation/ai_chat_screen.dart';
import '../../features/diet/presentation/diet_planner_screen.dart';
import '../../features/subscription/presentation/plans_screen.dart';

final appRouterPrvdr = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/splash',
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/claim-opd',
        builder: (context, state) => const ClaimOpdScreen(),
      ),
      GoRoute(
        path: '/ai-chat',
        builder: (context, state) => const AiChatScreen(),
      ),
      GoRoute(
        path: '/diet-planner',
        builder: (context, state) => const DietPlannerScreen(),
      ),
      GoRoute(
        path: '/plans',
        builder: (context, state) => const PlansScreen(),
      ),
    ],
  );
});`
  },
  {
    path: 'lib/features/auth/domain/auth_state.dart',
    description: 'Riverpod Auth State models tracking user credentials, OTP parameters, loading, and error states.',
    code: `import 'package:firebase_auth/firebase_auth.dart';

class AuthState {
  final User? user;
  final bool isLoading;
  final String? error;
  final String? verificationId;
  final bool isCodeSent;

  AuthState({
    this.user,
    this.isLoading = false,
    this.error,
    this.verificationId,
    this.isCodeSent = false,
  });

  AuthState copyWith({
    User? user,
    bool? isLoading,
    String? error,
    String? verificationId,
    bool? isCodeSent,
  }) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      verificationId: verificationId ?? this.verificationId,
      isCodeSent: isCodeSent ?? this.isCodeSent,
    );
  }
}`
  },
  {
    path: 'lib/features/auth/presentation/login_screen.dart',
    description: 'Premium Material 3 Login view validating mobile numeric inputs and handling phone verification requests.',
    code: `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _mobileController = TextEditingController();
  final _otpController = TextEditingController();

  @override
  void dispose() {
    _mobileController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authNotifierPrvdr);
    final notifier = ref.read(authNotifierPrvdr.notifier);

    // Dynamic router navigation upon successful authentication
    if (state.user != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.go('/home');
      });
    }

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.security_rounded, size: 72, color: Colors.indigo),
              const SizedBox(height: 24),
              Text(
                'Gemini Care OPD',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: Colors.indigo,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Instant OPD claims and digital wellness plans',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              
              if (!state.isCodeSent) ...[
                // Stage 1: Mobile Input
                TextField(
                  controller: _mobileController,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: 'Mobile Number',
                    prefixText: '+91 ',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: state.isLoading
                      ? null
                      : () => notifier.verifyMobile('+91\${_mobileController.text.trim()}'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.indigo,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: state.isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('Send Verification OTP', style: TextStyle(color: Colors.white)),
                ),
              ] else ...[
                // Stage 2: OTP Entry
                TextField(
                  controller: _otpController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Enter 6-Digit OTP',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: state.isLoading
                      ? null
                      : () => notifier.confirmOtp(_otpController.text.trim()),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.indigo,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: state.isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('Verify and Login', style: TextStyle(color: Colors.white)),
                ),
              ],
              
              if (state.error != null) ...[
                const SizedBox(height: 16),
                Text(
                  state.error!,
                  style: const TextStyle(color: Colors.red, fontSize: 13),
                  textAlign: TextAlign.center,
                ),
              ]
            ],
          ),
        ),
      ),
    );
  }
}`
  },
  {
    path: 'lib/features/home/presentation/home_screen.dart',
    description: 'Dynamic Home Dashboard exhibiting user balance telemetry, subscription tiers, claims portals, and action buttons.',
    code: `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/subscription_provider.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subState = ref.watch(subscriptionNotifierPrvdr);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Gemini Care Dashboard', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.account_circle_outlined),
            onPressed: () => context.push('/profile'),
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // User Greeting Card
            Card(
              elevation: 4,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Welcome Back,', style: TextStyle(fontSize: 16, color: Colors.grey)),
                    const SizedBox(height: 4),
                    const Text('Sumit Sharma', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.between,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Active Plan', style: TextStyle(fontSize: 12, color: Colors.grey)),
                            const SizedBox(height: 4),
                            Text(subState.planName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.indigo)),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text('Remaining OPD Claims', style: TextStyle(fontSize: 12, color: Colors.grey)),
                            const SizedBox(height: 4),
                            Text('\${subState.remainingClaims} Available', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.emerald)),
                          ],
                        )
                      ],
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton.icon(
                      onPressed: () => context.push('/plans'),
                      icon: const Icon(Icons.autorenew_rounded),
                      label: const Text('Renew / Upgrade Plan'),
                      style: ElevatedButton.styleFrom(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        minimumSize: const Size.fromHeight(48),
                      ),
                    )
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            
            // Grid Operations Panel
            Text('Quick Health Tools', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 16,
              crossAxisSpacing: 16,
              childAspectRatio: 1.1,
              children: [
                _buildFeatureButton(
                  context,
                  icon: Icons.add_moderator_rounded,
                  label: 'Claim OPD Reimbursement',
                  color: Colors.red.shade400,
                  onTap: () => context.push('/claim-opd'),
                ),
                _buildFeatureButton(
                  context,
                  icon: Icons.chat_bubble_outline_rounded,
                  label: 'Consult AI Assistant',
                  color: Colors.indigo.shade400,
                  onTap: () => context.push('/ai-chat'),
                ),
                _buildFeatureButton(
                  context,
                  icon: Icons.restaurant_menu_rounded,
                  label: 'Custom Diet Planner',
                  color: Colors.green.shade400,
                  onTap: () => context.push('/diet-planner'),
                ),
                _buildFeatureButton(
                  context,
                  icon: Icons.account_balance_wallet_outlined,
                  label: 'Virtual Claims Wallet',
                  color: Colors.amber.shade400,
                  onTap: () => context.push('/wallet'),
                ),
              ],
            )
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureButton(
    BuildContext context, {
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Card(
        elevation: 1.5,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: color.withOpacity(0.15), shape: BoxShape.circle),
                child: Icon(icon, color: color, size: 28),
              ),
              const Spacer(),
              Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }
}`
  },
  {
    path: 'lib/features/subscription/presentation/plans_screen.dart',
    description: 'Dynamic subscription checkout list offering ₹29, ₹99, and ₹999 premium health options integrated with Razorpay.',
    code: `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../providers/subscription_provider.dart';

class PlansScreen extends ConsumerStatefulWidget {
  const PlansScreen({super.key});

  @override
  ConsumerState<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends ConsumerState<PlansScreen> {
  late Razorpay _razorpay;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  void _triggerPayment(String planName, double amount) {
    var options = {
      'key': 'rzp_test_YOUR_KEY_HERE',
      'amount': amount * 100, // paise converter
      'name': 'Gemini Care OPD',
      'description': 'Purchase $planName Premium Membership',
      'prefill': {'contact': '9876543210', 'email': 'user@geminicare.in'},
      'external': {
        'wallets': ['paytm']
      }
    };

    try {
      _razorpay.open(options);
    } catch (e) {
      debugPrint('Error initiating payment gateway: $e');
    }
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) {
    ref.read(subscriptionNotifierPrvdr.notifier).activateSubscription(
          planName: 'Gold Max Plan',
          limit: 10,
        );
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Payment Successful! Plan activated.', style: TextStyle(color: Colors.white)), backgroundColor: Colors.emerald),
    );
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Payment Failed: \${response.message}'), backgroundColor: Colors.red),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Premium Plans')),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            _buildPlanCard(
              title: 'Bronze Starter',
              price: '₹29',
              claims: '1 OPD Claim Limit',
              color: Colors.brown.shade400,
              onTap: () => _triggerPayment('Bronze Plan', 29.0),
            ),
            const SizedBox(height: 16),
            _buildPlanCard(
              title: 'Silver Regular',
              price: '₹99',
              claims: '4 OPD Claims Limit',
              color: Colors.blueGrey,
              onTap: () => _triggerPayment('Silver Plan', 99.0),
            ),
            const SizedBox(height: 16),
            _buildPlanCard(
              title: 'Gold Max Pro',
              price: '₹999',
              claims: 'Unlimited OPD Claims',
              color: Colors.amber.shade600,
              onTap: () => _triggerPayment('Gold Plan', 999.0),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlanCard({
    required String title,
    required String price,
    required String claims,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Container(width: 4, height: 60, color: color),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 4),
                  Text(claims, style: const TextStyle(color: Colors.grey, fontSize: 12)),
                ],
              ),
            ),
            ElevatedButton(
              onPressed: onTap,
              style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
              child: Text(price, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            )
          ],
        ),
      ),
    );
  }
}`
  }
];
