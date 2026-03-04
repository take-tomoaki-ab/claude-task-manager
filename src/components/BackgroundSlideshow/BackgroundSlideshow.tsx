import { useEffect, useState, useRef } from 'react'

export default function BackgroundSlideshow() {
  // 2枚のレイヤーを常にDOMに保持し、active側だけ opacity:1 にする
  const [layers, setLayers] = useState<[string, string]>(['', ''])
  const [activeLayer, setActiveLayer] = useState<0 | 1>(0)
  const activeLayerRef = useRef<0 | 1>(0)
  const imagesRef = useRef<string[]>([])
  const indexRef = useRef(0)
  const intervalSecRef = useRef(30)

  useEffect(() => {
    window.api.settings.get().then((s) => {
      intervalSecRef.current = s.backgroundIntervalSec ?? 30
      const dir = s.backgroundImageDir
      if (!dir) return
      window.api.shell.listImages(dir).then((imgs) => {
        const shuffled = [...imgs].sort(() => Math.random() - 0.5)
        imagesRef.current = shuffled
        if (shuffled.length > 0) {
          setLayers([shuffled[0], ''])
        }
      })
    })
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const imgs = imagesRef.current
      if (imgs.length <= 1) return

      indexRef.current = (indexRef.current + 1) % imgs.length
      const nextPath = imgs[indexRef.current]
      const nextLayer: 0 | 1 = activeLayerRef.current === 0 ? 1 : 0

      // 非アクティブなレイヤーに次の画像をセット（この時点では opacity:0 なのでユーザーには見えない）
      setLayers((l) => {
        const updated: [string, string] = [l[0], l[1]]
        updated[nextLayer] = nextPath
        return updated
      })
      // アクティブレイヤーを切り替え → CSS transition でクロスフェード
      activeLayerRef.current = nextLayer
      setActiveLayer(nextLayer)
    }, intervalSecRef.current * 1000)

    return () => clearInterval(id)
  }, []) // 依存なし：ref で最新値を参照するのでリセット不要

  const hasImages = layers[0] !== '' || layers[1] !== ''

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#1a1b1e]">
      {[0, 1].map((layer) => (
        <div
          key={layer}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            opacity: layer === activeLayer ? 1 : 0,
            backgroundImage: layers[layer] ? `url("bg://local?path=${encodeURIComponent(layers[layer])}")` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      ))}
      {hasImages && <div className="absolute inset-0 bg-black/60" />}
    </div>
  )
}
