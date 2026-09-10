import 'dart:convert';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class FirmaCanvasWidget extends StatefulWidget {
  final double height;
  final ValueChanged<bool>? onSignatureChanged;
  final ValueChanged<String>? onConfirm;

  const FirmaCanvasWidget({
    super.key,
    this.height = 200,
    this.onSignatureChanged,
    this.onConfirm,
  });

  @override
  State<FirmaCanvasWidget> createState() => FirmaCanvasWidgetState();
}

class FirmaCanvasWidgetState extends State<FirmaCanvasWidget> {
  final List<Offset?> _points = [];
  final GlobalKey _paintKey = GlobalKey();

  // Requiere un trazo real consistente (al menos 20 puntos) para considerar firma válida
  bool get hasSignature => _points.where((p) => p != null).length >= 20;

  void clear() {
    setState(() {
      _points.clear();
    });
    widget.onSignatureChanged?.call(false);
  }

  /// Exporta el trazo dibujado a una cadena base64 en formato data:image/png;base64,...
  Future<String?> exportBase64() async {
    if (!hasSignature) return null;

    final RenderBox? renderBox = _paintKey.currentContext?.findRenderObject() as RenderBox?;
    final double width = renderBox?.size.width ?? 350.0;
    final double height = widget.height;

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder, Rect.fromLTWH(0, 0, width, height));

    // Fondo blanco limpio
    final bgPaint = Paint()..color = Colors.white;
    canvas.drawRect(Rect.fromLTWH(0, 0, width, height), bgPaint);

    // Línea guía tenue para firma
    final guidePaint = Paint()
      ..color = const Color(0xFFCBD5E1)
      ..strokeWidth = 1.0;
    canvas.drawLine(
      Offset(width * 0.1, height * 0.78),
      Offset(width * 0.9, height * 0.78),
      guidePaint,
    );

    // Trazos de la firma
    final strokePaint = Paint()
      ..color = const Color(0xFF0F172A)
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..strokeWidth = 3.5;

    for (int i = 0; i < _points.length - 1; i++) {
      if (_points[i] != null && _points[i + 1] != null) {
        canvas.drawLine(_points[i]!, _points[i + 1]!, strokePaint);
      } else if (_points[i] != null && _points[i + 1] == null) {
        canvas.drawCircle(_points[i]!, 1.75, strokePaint);
      }
    }

    final picture = recorder.endRecording();
    final img = await picture.toImage(width.toInt(), height.toInt());
    final byteData = await img.toByteData(format: ui.ImageByteFormat.png);
    if (byteData == null) return null;

    final bytes = byteData.buffer.asUint8List();
    return 'data:image/png;base64,${base64Encode(bytes)}';
  }

  Future<void> _handleConfirm() async {
    final b64 = await exportBase64();
    if (b64 != null && widget.onConfirm != null) {
      widget.onConfirm!(b64);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: hasSignature ? const Color(0xFF10B981) : const Color(0xFFCBD5E1),
              width: hasSignature ? 2 : 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.15),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(15),
            child: Column(
              children: [
                // Cabecera del lienzo con instrucciones y botón de limpiar
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  color: const Color(0xFFF1F5F9),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            hasSignature ? Icons.check_circle_rounded : Icons.draw_rounded,
                            size: 18,
                            color: hasSignature ? const Color(0xFF10B981) : const Color(0xFF64748B),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            hasSignature ? 'Firma capturada correctamente' : 'Dibuje su firma con el dedo aquí',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: hasSignature ? const Color(0xFF047857) : const Color(0xFF475569),
                            ),
                          ),
                        ],
                      ),
                      TextButton.icon(
                        onPressed: _points.isEmpty ? null : clear,
                        style: TextButton.styleFrom(
                          visualDensity: VisualDensity.compact,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          foregroundColor: const Color(0xFFEF4444),
                        ),
                        icon: const Icon(Icons.refresh_rounded, size: 16),
                        label: Text(
                          'Limpiar',
                          style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ),

                // Área de dibujo con GestureDetector que captura eventos táctiles
                SizedBox(
                  height: widget.height,
                  width: double.infinity,
                  key: _paintKey,
                  child: Stack(
                    children: [
                      // Marca de agua / placeholder si no hay trazos
                      if (_points.isEmpty)
                        Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.edit_note_rounded,
                                size: 40,
                                color: const Color(0xFF94A3B8).withValues(alpha: 0.5),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Realice el trazo de la firma en este cuadro',
                                style: GoogleFonts.inter(
                                  fontSize: 12.5,
                                  color: const Color(0xFF94A3B8),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),

                      // Captura táctil fluida
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onPanStart: (details) {
                          setState(() {
                            _points.add(details.localPosition);
                          });
                        },
                        onPanUpdate: (details) {
                          setState(() {
                            _points.add(details.localPosition);
                          });
                        },
                        onPanEnd: (details) {
                          setState(() {
                            _points.add(null);
                          });
                          widget.onSignatureChanged?.call(hasSignature);
                        },
                        child: CustomPaint(
                          painter: _SignaturePainter(points: _points),
                          size: Size.infinite,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        // Botón de confirmación opcional si se pasa el callback onConfirm
        if (widget.onConfirm != null) ...[
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: hasSignature ? const Color(0xFF10B981) : const Color(0xFF64748B),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.check_rounded, color: Colors.white),
              label: Text(
                hasSignature ? 'Confirmar y Guardar Firma' : 'Dibuje la firma para continuar',
                style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 14),
              ),
              onPressed: hasSignature ? _handleConfirm : null,
            ),
          ),
        ],
      ],
    );
  }
}

class _SignaturePainter extends CustomPainter {
  final List<Offset?> points;

  _SignaturePainter({required this.points});

  @override
  void paint(Canvas canvas, Size size) {
    // Línea de base suave para referencia de firma
    final guidePaint = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..strokeWidth = 1.0;
    canvas.drawLine(
      Offset(size.width * 0.08, size.height * 0.78),
      Offset(size.width * 0.92, size.height * 0.78),
      guidePaint,
    );

    final paint = Paint()
      ..color = const Color(0xFF0F172A)
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..strokeWidth = 3.5;

    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != null && points[i + 1] != null) {
        canvas.drawLine(points[i]!, points[i + 1]!, paint);
      } else if (points[i] != null && points[i + 1] == null) {
        canvas.drawCircle(points[i]!, 1.75, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) {
    return oldDelegate.points.length != points.length;
  }
}
