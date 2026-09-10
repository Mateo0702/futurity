import 'package:flutter_test/flutter_test.dart';
import 'package:futurity_mobile_test/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const FuturityAtlasApp());
    expect(find.text('FUTURITY ATLAS'), findsOneWidget);
  });
}
