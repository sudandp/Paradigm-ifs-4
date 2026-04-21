import React from 'react';
import { Controller } from 'react-hook-form';
import Input from '../../ui/Input';

interface UniformScale {
    id: string;
    size: string;
    fit: string;
    [key: string]: any;
}

interface UniformSizeTableProps {
    title: string;
    sizes: UniformScale[];
    headers: { key: string, label: string }[];
    control?: any;
    /** Path to the specific designation in the form state, e.g. "departments.0.designations.0" */
    nestingPath?: string;
    /** Field name for quantities, e.g. "pantsQuantities" */
    quantityField?: string;
    /** Field name for costs, e.g. "pantsCosts" */
    costField?: string;
    /** Whether the table is in read-only mode (Dashboard view) */
    readOnly?: boolean;
    /** External data for read-only mode */
    quantities?: Record<string, number | null>;
    costs?: Record<string, number | null>;
    /** Show standard "Qty" and "Cost" columns? Default true/true */
    showQuantity?: boolean;
    showCost?: boolean;
}

/**
 * A reusable table for managing uniform sizes, quantities, and costs.
 * Used in site configuration, request forms, and dashboards.
 */
const UniformSizeTable: React.FC<UniformSizeTableProps> = ({
    title,
    sizes,
    headers,
    control,
    nestingPath,
    quantityField,
    costField,
    readOnly = false,
    quantities,
    costs,
    showQuantity = true,
    showCost = true,
}) => {
    // Unique fits and sizes for grouping
    const fits = Array.from(new Set(sizes.map(s => s.fit)));
    const sizeKeys = Array.from(new Set(sizes.map(s => s.size))).sort((a, b) => {
        const numA = parseInt(String(a));
        const numB = parseInt(String(b));
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return String(a).localeCompare(String(b));
    });

    const getFieldPath = (field: string, id: string) => {
        return nestingPath ? `${nestingPath}.${field}.${id}` : `${field}.${id}`;
    };

    return (
        <div className="border border-border rounded-xl flex flex-col overflow-hidden bg-card shadow-sm">
            <div className="px-4 py-3 bg-page/50 border-b border-border flex justify-between items-center">
                <h4 className="font-bold text-primary-text">{title}</h4>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-page/30">
                        <tr className="border-b border-border">
                            <th className="px-3 py-2 text-left font-semibold text-muted/80 uppercase tracking-wider text-[10px]">Size</th>
                            {headers.map(h => (
                                <th key={h.key} className="px-3 py-2 text-left font-semibold text-muted/80 uppercase tracking-wider text-[10px]">
                                    {h.label}
                                </th>
                            ))}
                            {showQuantity && <th className="px-3 py-2 text-left font-semibold text-muted/80 uppercase tracking-wider text-[10px] w-20">Qty</th>}
                            {showCost && <th className="px-3 py-2 text-left font-semibold text-muted/80 uppercase tracking-wider text-[10px] w-24">Cost (₹)</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {sizeKeys.map(sizeKey => {
                            const availableFitsForSize = fits.filter(f => sizes.some(s => s.size === sizeKey && s.fit === f));
                            return (
                                <React.Fragment key={sizeKey}>
                                    {availableFitsForSize.map((fit, fitIndex) => {
                                        const item = sizes.find(s => s.size === sizeKey && s.fit === fit);
                                        if (!item) return null;

                                        return (
                                            <tr key={item.id} className="hover:bg-page/10 transition-colors">
                                                {fitIndex === 0 && (
                                                    <td 
                                                        rowSpan={availableFitsForSize.length} 
                                                        className="px-3 py-2 align-middle font-bold border-r border-border bg-page/5 text-center min-w-[60px]"
                                                    >
                                                        {sizeKey}
                                                    </td>
                                                )}
                                                {headers.map(h => (
                                                    <td key={h.key} className="px-3 py-2 text-primary-text/80">
                                                        {item[h.key]}
                                                    </td>
                                                ))}
                                                
                                                {showQuantity && (
                                                    <td className="px-3 py-2">
                                                        {readOnly ? (
                                                            <span className="font-mono font-medium text-primary-text block text-center">
                                                                {quantities?.[item.id] || 0}
                                                            </span>
                                                        ) : (
                                                            <Controller
                                                                name={getFieldPath(quantityField!, item.id)}
                                                                control={control}
                                                                render={({ field }) => (
                                                                    <Input 
                                                                        type="number" 
                                                                        {...field} 
                                                                        value={field.value || ''} 
                                                                        onChange={e => field.onChange(parseInt(e.target.value) || null)}
                                                                        className="!py-1 !px-2 text-center h-8"
                                                                        placeholder="0"
                                                                    />
                                                                )}
                                                            />
                                                        )}
                                                    </td>
                                                )}

                                                {showCost && (
                                                    <td className="px-3 py-2">
                                                        {readOnly ? (
                                                            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400 block text-center">
                                                                {costs?.[item.id] ? `₹${costs[item.id]}` : '—'}
                                                            </span>
                                                        ) : (
                                                            <Controller
                                                                name={getFieldPath(costField!, item.id)}
                                                                control={control}
                                                                render={({ field }) => (
                                                                    <Input 
                                                                        type="number" 
                                                                        {...field} 
                                                                        value={field.value || ''} 
                                                                        onChange={e => field.onChange(parseInt(e.target.value) || null)}
                                                                        className="!py-1 !px-2 text-center h-8 border-emerald-500/20 focus:border-emerald-500"
                                                                        placeholder="0"
                                                                    />
                                                                )}
                                                            />
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UniformSizeTable;
