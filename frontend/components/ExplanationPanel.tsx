'use client';

import { FeatureContribution } from '@/types';
import { HelpCircle, TrendingUp, TrendingDown, Layers } from 'lucide-react';

interface ExplanationPanelProps {
  explanations: FeatureContribution[];
  predictedDelay: number;
}

export default function ExplanationPanel({ explanations, predictedDelay }: ExplanationPanelProps) {
  if (!explanations || explanations.length === 0) {
    return null;
  }

  const positiveFeatures = explanations.filter((e) => e.direction === 'positive');
  const negativeFeatures = explanations.filter((e) => e.direction === 'negative');

  return (
    <div className="rail-card p-6">
      <div className="flex items-center justify-between mb-4 border-b border-[#D8E3EE] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#E6F7FD] text-[#00A9E8] flex items-center justify-center font-bold">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#10233F]">Why your ETA changed</h3>
            <p className="text-xs text-[#64748B] font-medium">
              Explainable AI (SHAP) feature breakdown of real-time conditions
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-bold text-[#64748B] uppercase block">NET IMPACT</span>
          <span className="font-extrabold text-sm text-[#00A9E8]">+{predictedDelay.toFixed(1)} min</span>
        </div>
      </div>

      {/* Waterfall / Feature Bar Items */}
      <div className="space-y-3 my-4">
        {explanations.map((item, idx) => {
          const isPos = item.direction === 'positive';
          const maxImpact = 15;
          const barWidth = Math.min(100, (Math.abs(item.impact_minutes) / maxImpact) * 100);

          return (
            <div key={item.feature_key + idx} className="bg-[#EEF5F9]/60 p-3 rounded-lg border border-[#D8E3EE]">
              <div className="flex items-center justify-between text-xs font-bold text-[#10233F] mb-1.5">
                <div className="flex items-center gap-1.5">
                  {isPos ? (
                    <TrendingUp className="w-4 h-4 text-rose-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>{item.display_name}</span>
                </div>
                <span className={isPos ? 'text-rose-600' : 'text-emerald-700'}>
                  {isPos ? `+${item.impact_minutes.toFixed(1)} min` : `${item.impact_minutes.toFixed(1)} min`}
                </span>
              </div>

              {/* Progress Bar Visual */}
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isPos ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              <div className="text-[11px] text-[#64748B] font-medium">{item.description}</div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-[#64748B] bg-[#E6F7FD] p-2.5 rounded-lg border border-[#B8E8FA]">
        <Layers className="w-4 h-4 text-[#00A9E8] shrink-0" />
        <span>
          SHAP feature contribution values are computed dynamically by the XGBoost regressor model.
        </span>
      </div>
    </div>
  );
}
