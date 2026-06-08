package com.example.solar725

import android.annotation.SuppressLint
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.SslErrorHandler
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.example.solar725.theme.Solar725Theme

private const val DASHBOARD_URL = "https://monitor-solar-inverter-deye-battery.vercel.app/tv"

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enableEdgeToEdge()
        setContent {
            Solar725Theme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    SolarWebViewScreen(
                        onWebViewCreated = { wv ->
                            webView = wv
                        }
                    )
                }
            }
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            when (event.keyCode) {
                KeyEvent.KEYCODE_BACK,
                KeyEvent.KEYCODE_MENU -> {
                    webView?.loadUrl(freshDashboardUrl())
                    return true
                }
                KeyEvent.KEYCODE_DPAD_DOWN,
                KeyEvent.KEYCODE_PAGE_DOWN,
                KeyEvent.KEYCODE_SPACE -> {
                    scrollDashboard(1)
                    return true
                }
                KeyEvent.KEYCODE_DPAD_UP,
                KeyEvent.KEYCODE_PAGE_UP -> {
                    scrollDashboard(-1)
                    return true
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun scrollDashboard(direction: Int) {
        val script = """
            (() => {
              const target = document.querySelector('[data-tv-scroll]') || document.scrollingElement || document.documentElement;
              const step = Math.max(Math.floor(window.innerHeight * 0.58), 320);
              target.scrollBy({ top: ${direction} * step, behavior: 'smooth' });
            })();
        """.trimIndent()
        webView?.evaluateJavascript(script, null)
    }
}

private fun isLiteDevice(): Boolean {
    val manufacturer = Build.MANUFACTURER.lowercase()
    val model = Build.MODEL.lowercase()
    return manufacturer.contains("haier") || model.contains("haier") || model.contains("matrixtv")
}

private fun freshDashboardUrl(): String {
    val lite = if (isLiteDevice()) "&lite=1" else ""
    return "$DASHBOARD_URL?apk=2$lite&t=${System.currentTimeMillis()}"
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun SolarWebViewScreen(onWebViewCreated: (WebView) -> Unit) {
    AndroidView(
        factory = { context ->
            WebView(context).apply {
                setLayerType(View.LAYER_TYPE_SOFTWARE, null)
                keepScreenOn = true
                isFocusable = true
                isFocusableInTouchMode = true
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )

                setOnKeyListener { _: View, keyCode: Int, event: KeyEvent ->
                    if (event.action != KeyEvent.ACTION_DOWN) return@setOnKeyListener false
                    when (keyCode) {
                        KeyEvent.KEYCODE_DPAD_DOWN,
                        KeyEvent.KEYCODE_PAGE_DOWN,
                        KeyEvent.KEYCODE_SPACE -> {
                            evaluateJavascript(
                                "(() => { const t = document.querySelector('[data-tv-scroll]') || document.scrollingElement || document.documentElement; const s = Math.max(Math.floor(window.innerHeight * 0.58), 320); t.scrollBy({ top: s, behavior: 'smooth' }); })();",
                                null
                            )
                            true
                        }
                        KeyEvent.KEYCODE_DPAD_UP,
                        KeyEvent.KEYCODE_PAGE_UP -> {
                            evaluateJavascript(
                                "(() => { const t = document.querySelector('[data-tv-scroll]') || document.scrollingElement || document.documentElement; const s = Math.max(Math.floor(window.innerHeight * 0.58), 320); t.scrollBy({ top: -s, behavior: 'smooth' }); })();",
                                null
                            )
                            true
                        }
                        else -> false
                    }
                }
                
                webViewClient = object : WebViewClient() {
                    @Deprecated("Deprecated in Java")
                    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                        return false // Force navigation to stay inside this WebView
                    }

                    // Ignore SSL errors (crucial for local/private network streams like go2rtc/Tailscale on TV)
                    override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                        handler?.proceed()
                    }
                }

                clearCache(true)

                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    databaseEnabled = true
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    mediaPlaybackRequiresUserGesture = false // Allow fMP4 streams to autoplay on TV
                    useWideViewPort = true
                    loadWithOverviewMode = true
                    cacheMode = WebSettings.LOAD_NO_CACHE
                }

                loadUrl(freshDashboardUrl())
                requestFocus()
                requestFocusFromTouch()
                onWebViewCreated(this)
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}
