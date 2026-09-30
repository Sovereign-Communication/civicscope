/**
 * The map view.
 *
 * Canvas 2D, no tile server, no map framework. That is a deliberate choice
 * rather than a simplification: a tile-based map would mean a third-party origin
 * in the Content-Security-Policy, a runtime dependency on someone else's
 * uptime, and a request log for every visitor. All this needs is 33,791
 * positions the app already has numbers for, and those are baked into a
 * 165 KB file served from the same origin.
 *
 * Accessibility drives one thing above all: a canvas is invisible to a screen
 * reader. So the map is presented as a *visual* view of the same data, with the
 * screening table remaining the accessible path to every figure, and the legend
 * spelled out in text rather than in colour swatches alone. Nothing on this
 * surface can be the only way to reach a number.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import { hexbin, HEX_CORNERS, type BinInput } from '../core/map/binning'
import { loadMapAssets, createView, fitBase, type Basemap, type Viewport } from '../core/map/projection'
import type { ZctaPoint } from '../core/map/centroids'
import {
  buildBins,
  binFor,
  formatValue,
  MAP_METRICS,
  NO_DATA_COLOR,
  NO_DATA_LABEL,
  type MapMetricKey,
} from '../core/map/scale'
import type { AreaRow } from '../core/plugins/acs'
import { FairHousingNotice } from './FairHousingNotice'

interface Props {
  rows: readonly AreaRow[]
  onSelect: (zctas: string[]) => void
}

interface Hover {
  cx: number
  cy: number
  value: number | null
  count: number
  withValue: number
  zctas: string[]
}

export function MapView({ rows, onSelect }: Props) {
  const headingId = useId()
  const legendId = useId()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const [metric, setMetric] = useState<MapMetricKey>('median_rent_burden_pct')
  const [assets, setAssets] = useState<{ centroids: ZctaPoint[]; basemap: Basemap | null } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const [viewport, setViewport] = useState<Viewport>({
    width: 900,
    height: 560,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  })

  const unit = useMemo(
    () => MAP_METRICS.find((m) => m.key === metric)?.unit ?? 'usd',
    [metric],
  )

  // Values by ZIP, so a point and its figure are looked up the same way.
  const valueByZcta = useMemo(() => {
    const m = new Map<string, number | null>()
    for (const row of rows) m.set(row.zcta, row.metrics[metric] ?? null)
    return m
  }, [rows, metric])

  const bins = useMemo(
    () => buildBins([...valueByZcta.values()].filter((v): v is number => v !== null)),
    [valueByZcta],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadMapAssets(controller.signal)
      .then(setAssets)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setLoadError(err instanceof Error ? err.message : 'the map could not be loaded')
      })
    return () => controller.abort()
  }, [])

  // Keep the backing store matched to the CSS box, so the map is not blurry on
  // a high-DPI screen.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      setViewport((v) => ({ ...v, width: Math.round(rect.width), height: Math.round(rect.height) }))
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  // The fit is computed once when the assets arrive, not per frame: it
  // projects all 33,791 positions, and recomputing it on every pan or zoom
  // would make dragging the map janky for no benefit.
  const fit = useMemo(() => (assets ? fitBase(assets.centroids) : null), [assets])

  const geoms = useMemo(() => {
    if (!assets || !fit) return []
    const view = createView(fit, viewport, assets.basemap)
    const inputs: BinInput[] = []
    for (const point of assets.centroids) {
      const p = view.project(point.lon, point.lat)
      if (!p) continue
      if (p[0] < -40 || p[0] > viewport.width + 40 || p[1] < -40 || p[1] > viewport.height + 40) continue
      const value = valueByZcta.get(point.zcta)
      // A point with no usable figure is kept, so it renders as explicitly
      // absent rather than quietly vanishing from the map.
      inputs.push({
        x: p[0],
        y: p[1],
        value: value === null || value === undefined ? Number.NaN : value,
        zctas: [point.zcta],
      })
    }
    return hexbin(inputs)
  }, [assets, fit, viewport, valueByZcta])

  // Canvas has no accessibility tree, so an equivalent is published as live
  // text. A screen-reader user gets the bins, not silence.
  const summary = useMemo(() => {
    const shown = geoms.length
    const withValue = geoms.filter((g) => g.value !== null).length
    if (shown === 0) return 'The map has not drawn any areas yet.'
    return (
      `The map shows ${shown.toLocaleString('en-US')} areas. ` +
      `${withValue.toLocaleString('en-US')} have a ${MAP_METRICS.find((m) => m.key === metric)?.label} figure. ` +
      `Every figure is also listed in the screening table.`
    )
  }, [geoms, metric])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !assets || !fit) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(viewport.width * dpr)
    canvas.height = Math.round(viewport.height * dpr)
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, viewport.width, viewport.height)

    const view = createView(fit, viewport, assets.basemap)

    // Basemap first, so data sits on top of it.
    if (assets.basemap) {
      ctx.save()
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 1
      view.outlines()(ctx)
      ctx.restore()
    }

    for (const bin of geoms) {
      const r = Math.min(14, 4 + Math.sqrt(bin.count) * 2.2)
      const color = bin.value === null ? NO_DATA_COLOR : (binFor(bins, bin.value)?.color ?? NO_DATA_COLOR)
      ctx.beginPath()
      HEX_CORNERS.forEach(([dx, dy], i) => {
        const x = bin.cx + dx * r
        const y = bin.cy + dy * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
      // An outline keeps adjacent hexagons separable and gives the no-data grey
      // a visible edge rather than blending into the background.
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 0.75
      ctx.stroke()
    }
  }, [assets, fit, viewport, geoms, bins])

  useEffect(() => {
    draw()
  }, [draw])

  const hit = useCallback(
    (clientX: number, clientY: number): Hover | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      for (const bin of geoms) {
        const r = Math.min(14, 4 + Math.sqrt(bin.count) * 2.2)
        const dx = x - bin.cx
        const dy = y - bin.cy
        // Hexagon containment, without solving the polygon: the bounding
        // hexagon test is a regular hexagon, so the exact apothem check is
        // both cheaper and correct.
        if (Math.abs(dx) > r || Math.abs(dy) > r) continue
        if (Math.abs(dx) * 0.866 + Math.abs(dy) * 0.5 <= r) {
          return {
            cx: bin.cx,
            cy: bin.cy,
            value: bin.value,
            count: bin.count,
            withValue: bin.withValue,
            zctas: bin.zctas,
          }
        }
      }
      return null
    },
    [geoms],
  )

  const zoomBy = useCallback((factor: number) => {
    setViewport((v) => ({ ...v, scale: v.scale * factor }))
  }, [])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLCanvasElement>) => {
      const step = 40
      switch (event.key) {
        case 'ArrowLeft':
          setViewport((v) => ({ ...v, offsetX: v.offsetX + step }))
          break
        case 'ArrowRight':
          setViewport((v) => ({ ...v, offsetX: v.offsetX - step }))
          break
        case 'ArrowUp':
          setViewport((v) => ({ ...v, offsetY: v.offsetY + step }))
          break
        case 'ArrowDown':
          setViewport((v) => ({ ...v, offsetY: v.offsetY - step }))
          break
        case '+':
        case '=':
          zoomBy(1.4)
          break
        case '-':
        case '_':
          zoomBy(1 / 1.4)
          break
        case '0':
          setViewport((v) => ({ ...v, scale: 1, offsetX: 0, offsetY: 0 }))
          break
        default:
          return
      }
      event.preventDefault()
    },
    [zoomBy],
  )

  const active = MAP_METRICS.find((m) => m.key === metric)
  const covered = useMemo(() => geoms.filter((g) => g.value !== null).length, [geoms])

  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className="text-lg font-semibold text-slate-900">
        Map
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-700">
        One hexagon per area, coloured by the selected figure. Each hexagon covers one or more ZIP codes and
        shows the median of those that have a figure, and only where at least half of them do. Point at one to
        see how many ZIP codes it covers and how many carried a figure. Every figure is also in the screening
        table, which is the accessible way to read this data.
      </p>

      <fieldset className="mt-3">
        <legend className="text-sm font-semibold text-slate-900">Figure to map</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {MAP_METRICS.map((m) => (
            <label key={m.key} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="radio"
                name={`map-metric-${headingId}`}
                value={m.key}
                checked={metric === m.key}
                onChange={() => setMetric(m.key)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`inline-block h-3 w-3 rounded-full border ${
                  metric === m.key ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-white'
                }`}
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      {loadError ? (
        <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          The map could not be drawn: {loadError}. The screening table below still shows every figure.
        </p>
      ) : null}

      <div
        ref={wrapRef}
        className="relative mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="img"
          aria-labelledby={`${headingId} ${legendId}`}
          onKeyDown={onKeyDown}
          onMouseMove={(e) => setHover(hit(e.clientX, e.clientY))}
          onMouseLeave={() => setHover(null)}
          onClick={() => {
            if (hover && hover.zctas.length > 0) onSelect(hover.zctas)
          }}
          className="block h-[560px] w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        />
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 max-w-xs rounded-md border border-slate-300 bg-white p-2 text-xs shadow-sm"
            style={{
              left: Math.min(hover.cx + 12, viewport.width - 180),
              top: Math.min(hover.cy + 12, viewport.height - 90),
            }}
          >
            <p className="font-semibold text-slate-900">
              {hover.value === null
                ? NO_DATA_LABEL
                : formatValue(hover.value, unit)}
            </p>
            <p className="text-slate-700">
              {hover.count === 1 ? hover.zctas[0] : `${hover.count} ZIP codes`}
              {hover.withValue < hover.count
                ? `, ${hover.withValue} with a figure`
                : ''}
            </p>
            {hover.zctas.length <= 4 ? (
              <p className="text-slate-600">{hover.zctas.join(', ')}</p>
            ) : null}
          </div>
        ) : null}
        <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-white/80 px-1.5 py-0.5 text-[11px] text-slate-700">
          Arrow keys pan, + and − zoom, 0 resets. Click an area to compare it.
        </p>
      </div>

      {/* The legend is real text, not swatches alone, so the scale is readable
          without colour perception. */}
      <div id={legendId} className="mt-2 text-sm">
        <p className="font-semibold text-slate-900">
          Legend — {active?.label}
          {bins.length === 0 ? ' (no figures loaded yet)' : ''}
        </p>
        {bins.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-700">
            {bins.map((bin) => (
              <li key={bin.color} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 rounded-sm border border-white"
                  style={{ backgroundColor: bin.color }}
                />
                {formatValue(bin.from, unit)} to {bin.to === null ? 'the highest' : formatValue(bin.to, unit)}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-sm border border-white"
                style={{ backgroundColor: NO_DATA_COLOR }}
              />
              {NO_DATA_LABEL}
            </li>
          </ul>
        ) : null}
        <p className="mt-1 text-xs text-slate-600">
          {covered.toLocaleString('en-US')} of {geoms.length.toLocaleString('en-US')} areas have a figure, and
          a grey hexagon is one where fewer than half of its ZIP codes had one. Alaska, Hawaii and Puerto Rico
          are drawn as insets.
        </p>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {summary}
      </p>

      <div className="mt-4">
        <FairHousingNotice />
      </div>
    </section>
  )
}
