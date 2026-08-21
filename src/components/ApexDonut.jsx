import React, { useEffect, useRef } from 'react';
import ApexCharts from 'apexcharts';

export default function ApexDonut({ 
  series = [], 
  labels = [], 
  colors, 
  size = '65%', 
  onPointSelected, 
  totalLabel = 'รายการ', 
  totalValueFormatter, 
  showLegend = true, 
  height = 320, 
  legendFontSize = '12px', 
  maxWidth = '550px',
  legendOptions = {}
}) {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const onPointSelectedRef = useRef(onPointSelected);
  onPointSelectedRef.current = onPointSelected;

  const totalValueFormatterRef = useRef(totalValueFormatter);
  totalValueFormatterRef.current = totalValueFormatter;

  const lastTriggerTimeRef = useRef(0);

  const triggerSelection = (idx) => {
    if (idx === undefined || idx === null || idx === -1 || isNaN(idx)) return;
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 150) return; // prevent duplicate rapid triggers
    lastTriggerTimeRef.current = now;
    if (onPointSelectedRef.current) {
      onPointSelectedRef.current(idx);
    }
  };

  const seriesKey = JSON.stringify(series);
  const labelsKey = JSON.stringify(labels);
  const colorsKey = JSON.stringify(colors);
  const legendOptionsKey = JSON.stringify(legendOptions);

  // DOM-level click delegation for maximum reliability across browsers and touch devices
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const handleDomClick = (e) => {
      // 1. Check if clicked a donut slice path
      const slice = e.target.closest('path.apexcharts-pie-area, path[j], path[data\\:realIndex]');
      if (slice) {
        let j = slice.getAttribute('j') ?? slice.getAttribute('data:realIndex');
        if (j !== null && j !== undefined) {
          const idx = parseInt(j, 10);
          if (!isNaN(idx) && idx >= 0) {
            triggerSelection(idx);
            return;
          }
        }
      }

      // 2. Check if clicked a legend item
      const legend = e.target.closest('.apexcharts-legend-series');
      if (legend) {
        const rel = legend.getAttribute('rel');
        if (rel) {
          const idx = parseInt(rel, 10) - 1;
          if (!isNaN(idx) && idx >= 0) {
            triggerSelection(idx);
            return;
          }
        }
      }
    };

    container.addEventListener('click', handleDomClick, true);
    return () => container.removeEventListener('click', handleDomClick, true);
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (!series || series.length === 0 || series.every(v => v === 0)) return;

    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.destroy();
      } catch {
        // ignore
      }
      chartInstanceRef.current = null;
    }

    const options = {
      series: series,
      labels: labels,
      chart: {
        type: 'donut',
        height: height,
        fontFamily: 'Inter, sans-serif',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 1000,
          dynamicAnimation: {
            enabled: true,
            speed: 800
          }
        },
        events: {
          dataPointSelection: (_event, _chartContext, config) => {
            const idx = (config && config.dataPointIndex !== undefined && config.dataPointIndex !== -1)
              ? config.dataPointIndex 
              : (config && config.seriesIndex !== undefined ? config.seriesIndex : -1);
            triggerSelection(idx);
          },
          legendClick: (_chartContext, seriesIndex, _config) => {
            triggerSelection(seriesIndex);
          }
        }
      },
      states: {
        active: {
          allowMultipleDataPointsSelection: false,
          filter: { type: 'none' }
        },
        hover: {
          filter: { type: 'lighten', value: 0.15 }
        }
      },
      colors: colors,
      stroke: {
        show: false,
        width: 0
      },
      plotOptions: {
        pie: {
          expandOnClick: false,
          donut: {
            size: size,
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                color: 'var(--primary)',
                offsetY: -10
              },
              value: {
                show: true,
                fontSize: '16px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                color: 'var(--primary)',
                offsetY: 10,
                formatter: (val) => {
                  if (val === undefined || val === null) return '';
                  if (totalLabel === "มูลค่ารวม" || totalLabel === "มูลค่า") {
                    return '฿' + Math.round(val).toLocaleString();
                  }
                  return Math.round(val).toLocaleString();
                }
              },
              total: {
                show: true,
                label: totalLabel,
                fontSize: '12px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                color: 'var(--text-muted)',
                formatter: () => {
                  if (totalValueFormatterRef.current) {
                    return totalValueFormatterRef.current();
                  }
                  const total = series.reduce((a, b) => a + b, 0);
                  const absVal = Math.abs(total);
                  if (totalLabel === "มูลค่ารวม" || totalLabel === "มูลค่า") {
                    if (absVal >= 1e6) {
                      return '฿' + (total / 1e6).toFixed(2) + 'M';
                    } else if (absVal >= 1e3) {
                      return '฿' + (total / 1e3).toFixed(1) + 'K';
                    }
                    return '฿' + total.toLocaleString();
                  }
                  return total.toLocaleString();
                }
              }
            }
          }
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => val.toFixed(1) + "%",
        style: {
          fontWeight: 700
        }
      },
      legend: {
        show: showLegend,
        position: 'bottom',
        horizontalAlign: 'center',
        fontSize: legendFontSize,
        itemMargin: {
          horizontal: 8,
          vertical: 4
        },
        ...legendOptions
      },
      tooltip: {
        y: {
          formatter: (val) => {
            if (val === undefined || val === null) return '';
            const formatted = Math.round(val).toLocaleString();
            return (totalLabel === "มูลค่ารวม" || totalLabel === "มูลค่า") ? '฿' + formatted : formatted;
          }
        }
      }
    };

    chartInstanceRef.current = new ApexCharts(chartContainerRef.current, options);
    chartInstanceRef.current.render();

    return () => {
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.destroy();
        } catch {
          // ignore
        }
        chartInstanceRef.current = null;
      }
    };
  }, [series, labels, colors, legendOptions, seriesKey, labelsKey, colorsKey, size, totalLabel, showLegend, height, legendFontSize, legendOptionsKey]);

  return (
    <div 
      className="donut-chart-wrapper" 
      style={{ 
        width: '100%', 
        maxWidth: maxWidth, 
        margin: '0 auto', 
        cursor: 'pointer' 
      }}
    >
      <style>{`
        .donut-chart-wrapper .apexcharts-datalabels,
        .donut-chart-wrapper .apexcharts-datalabel,
        .donut-chart-wrapper .apexcharts-datalabels text,
        .donut-chart-wrapper .apexcharts-datalabels tspan {
          pointer-events: none !important;
        }
        .donut-chart-wrapper .apexcharts-pie-area,
        .donut-chart-wrapper .apexcharts-legend-series {
          cursor: pointer !important;
        }
      `}</style>
      <div ref={chartContainerRef} style={{ width: '100%', minHeight: height }} />
    </div>
  );
}
