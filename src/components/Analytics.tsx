import { useEffect } from 'react';
import { useStore } from '@/context/StoreProvider';

/**
 * Slots de analytics. Si el tenant cargó `ga_id` (Google Analytics 4) y/o
 * `meta_pixel_id` (Meta Pixel) en su config, inyectamos los scripts oficiales.
 * Si no, no hace nada. No implementamos analytics propio.
 */
export function Analytics() {
  const { gaId, metaPixelId } = useStore();

  // Google Analytics 4 (gtag.js)
  useEffect(() => {
    if (!gaId) return;
    if (document.getElementById('ga-gtag')) return;

    const s = document.createElement('script');
    s.id = 'ga-gtag';
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(s);

    const inline = document.createElement('script');
    inline.id = 'ga-gtag-init';
    inline.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
    document.head.appendChild(inline);
  }, [gaId]);

  // Meta (Facebook) Pixel
  useEffect(() => {
    if (!metaPixelId) return;
    if (document.getElementById('meta-pixel')) return;

    const inline = document.createElement('script');
    inline.id = 'meta-pixel';
    inline.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');`;
    document.head.appendChild(inline);

    const noscript = document.createElement('noscript');
    noscript.id = 'meta-pixel-noscript';
    noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1" alt="" />`;
    document.body.appendChild(noscript);
  }, [metaPixelId]);

  return null;
}
