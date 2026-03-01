import { useTheme } from '@/contexts/ThemeContext';
import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

/**
 * MathRenderer — renders text with KaTeX math formulas.
 * 
 * On web: uses dangerouslySetInnerHTML with KaTeX CSS/JS from CDN.
 * On native: uses react-native-webview.
 * 
 * Falls back to plain text if no math delimiters found.
 * Handles invalid LaTeX gracefully (shows raw text).
 */

interface MathRendererProps {
    content: string;
    style?: object;
    fontSize?: number;
}

function hasLatex(text: string): boolean {
    return /\$[^$]+\$/.test(text) || /\\frac|\\text|\\times|\\div/.test(text);
}

function buildKatexHtml(content: string, isDark: boolean, fontSize: number): string {
    const bgColor = isDark ? '#161B22' : '#FFFFFF';
    const textColor = isDark ? '#E6EDF3' : '#1F2328';

    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: ${bgColor};
      color: ${textColor};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.6;
      padding: 4px 0;
      -webkit-text-size-adjust: none;
    }
    .katex { font-size: 1em !important; }
    .katex-display { margin: 8px 0 !important; }
  </style>
</head>
<body>
  <div id="content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\$/g, '$$')}</div>
  <script>
    try {
      renderMathInElement(document.getElementById('content'), {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    } catch(e) {}
    // Report height to parent
    const h = document.body.scrollHeight;
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: h }));
    }
  </script>
</body>
</html>`;
}

export default function MathRenderer({ content, style, fontSize = 15 }: MathRendererProps) {
    const { colors, isDark } = useTheme();
    const [webViewHeight, setWebViewHeight] = useState(40);

    const onMessage = useCallback((event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'height' && data.value > 0) {
                setWebViewHeight(data.value + 8);
            }
        } catch { }
    }, []);

    // If no LaTeX, render as plain text (much faster)
    if (!hasLatex(content)) {
        return (
            <Text style={[styles.plainText, { color: colors.textPrimary, fontSize }, style]}>
                {content}
            </Text>
        );
    }

    // Web platform: use div with KaTeX CDN
    if (Platform.OS === 'web') {
        return (
            <View style={[styles.container, style]}>
                <WebMathRenderer content={content} isDark={isDark} fontSize={fontSize} />
            </View>
        );
    }

    // Native platform: use WebView
    const WebView = require('react-native-webview').default;
    const html = buildKatexHtml(content, isDark, fontSize);

    return (
        <View style={[styles.container, style]}>
            <WebView
                source={{ html }}
                style={[styles.webview, { height: webViewHeight }]}
                scrollEnabled={false}
                onMessage={onMessage}
                originWhitelist={['*']}
                javaScriptEnabled
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

/**
 * Web-only math renderer using KaTeX auto-render via script injection.
 */
function WebMathRenderer({ content, isDark, fontSize }: { content: string; isDark: boolean; fontSize: number }) {
    const textColor = isDark ? '#E6EDF3' : '#1F2328';

    // For web, we render in an iframe to isolate KaTeX styles
    const html = buildKatexHtml(content, isDark, fontSize);
    const [height, setHeight] = useState(40);

    return (
        <iframe
            srcDoc={html}
            style={{
                width: '100%',
                height: height,
                border: 'none',
                overflow: 'hidden',
                backgroundColor: 'transparent',
                pointerEvents: 'none' as any, // Let clicks pass through to parent TouchableOpacity
            }}
            scrolling="no"
            onLoad={(e: any) => {
                try {
                    const doc = e.target.contentDocument || e.target.contentWindow?.document;
                    if (doc) {
                        const h = doc.body.scrollHeight;
                        if (h > 0) setHeight(h + 8);
                    }
                } catch { }
            }}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    plainText: {
        lineHeight: 24,
    },
    webview: {
        backgroundColor: 'transparent',
        width: '100%',
    },
});
