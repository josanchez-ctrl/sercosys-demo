import React from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, PackageCheck } from 'lucide-react';
import { formatearFecha, formatDateSystemToDDMMYYYY } from '../../util/workDate';

const isVariableWeight = (name) => {
    if (!name) return false;
    const upper = name.toUpperCase();
    return ['BOLSA', 'BANDEJA', 'BOL', 'GRANEL', 'BOTE', 'SACO'].some(term => upper.includes(term));
};

const EtiquetasTrackingRecepcionModal = ({ isOpen, onClose, inventario = [] }) => {
    if (!isOpen) return null;

    const encodeCode128 = (text) => {
        if (!text) return '';
        let checksum = 104;
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            const value = charCode - 32;
            checksum += (i + 1) * value;
        }
        checksum %= 103;

        const getChar = (val) => {
            if (val >= 0 && val <= 94) return String.fromCharCode(val + 32);
            // Mapeo para caracteres especiales de Code 128 en la fuente Libre Barcode
            // 95: Ã, 96: Ä, 97: Å, 98: Æ, 99: Ç, 100: È, 101: É, 102: Ê
            return String.fromCharCode(val + 100);
        };

        // Start B (Ì) + Data + Checksum + Stop (Î)
        return String.fromCharCode(204) + text + getChar(checksum) + String.fromCharCode(206);
    };

    const handlePrint = () => {
        // Crear un iframe oculto para la impresión
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow.document;

        const html = `
            <html>
                <head>
                    <title>Impresión de Etiquetas - Sercosys</title>
                    <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
                    <style>
                        @page { size: 80mm 50mm; margin: 0; }
                        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: #fff; }
                        .label { 
                            width: 76mm; 
                            height: 46mm; 
                            border: 1px solid #000; 
                            padding: 8px; 
                            box-sizing: border-box;
                            display: flex;
                            flex-direction: column;
                            page-break-after: always;
                            margin: 2mm auto;
                            position: relative;
                            overflow: hidden;
                        }
                        .header { border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: start; }
                        .brand { font-weight: 900; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
                        .tracking-text { font-family: monospace; font-size: 10px; font-weight: 900; background: #f0f0f0; padding: 2px 4px; }
                        
                        .content { display: flex; flex-direction: column; }
                        .product-name { font-weight: 900; font-size: 11px; margin-bottom: 2px; text-transform: uppercase; line-height: 1.1; }
                        .details-box { display: flex; justify-content: space-between; gap: 10px; background: #f9f9f9; padding: 3px 6px;}
                        .detail-item { display: flex; flex-direction: column; }
                        .detail-label { font-size: 6px; text-transform: uppercase; color: #666; font-weight: bold; line-height: 1; }
                        .detail-value { font-size: 8px; font-weight: 900; line-height: 1.2; }
                        
                        .barcode-container { flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0; }
                        .barcode { font-family: 'Libre Barcode 128', cursive; font-size: 38px; line-height: 1; margin: 0; color: #000; font-weight: normal; }
                        
                        .footer { border-top: 2px solid #000; padding-top: 4px; margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding-bottom: 2px; }
                        .logistics { display: flex; flex-direction: column; }
                        .logistics-badge { font-weight: 900; font-size: 8px; text-transform: uppercase; line-height: 1; }
                        .logistics-sub { font-size: 7px; font-weight: 700; color: #444; margin-top: 2px; }
                        .bulto-badge {  color: #000; font-size: 9px; font-weight: 900; text-transform: uppercase; }
                    </style>
                </head>
                <body>
                    ${inventario.flatMap(item => {
            const bultos = Math.max(1, Math.floor(item.detalle?.cantidad || 1));
            const encodedBarcode = encodeCode128(item.tracking_id);
            const presName = item.detalle?.logistica?.presentacion?.nombre || 'UNIDAD';
            const isVarWeight = isVariableWeight(presName);
            const cantDisplay = isVarWeight
                ? 'Cant: _________________ KG'
                : `Cant: x${(item.cantidad_actual / (item.detalle?.cantidad || 1)).toFixed(2)} KG`;

            return Array.from({ length: bultos }).map((_, index) => `
                            <div class="label">
                                <div class="header">
                                    <div style="display: flex; flex-direction: column;">
                                        <span class="brand">SERCOSYS CORE</span>
                                        <span style="font-size: 6px; font-weight: bold; color: #666; font-style: italic;">WMS Logistics Unit</span>
                                    </div>
                                    <span class="tracking-text">${item.tracking_id}</span>
                                </div>
                                <div class="content">
                                    <div class="product-name">${item.producto?.rubro?.nombre || 'PRODUCTO'} ${item.producto?.marca?.nombre || ''} ${item.producto?.variedad}</div>
                                    <div class="details-box">
                                        <div style="display: flex; gap: 10px;">
                                            <div class="detail-item">
                                                <span class="detail-label">Lote</span>
                                                <span class="detail-value">${item.lote || 'S/L'}</span>
                                            </div>
                                            <div class="detail-item" style="border-left: 1px solid #ccc; padding-left: 8px;">
                                                <span class="detail-label">Vencimiento</span>
                                                <span class="detail-value">${item.fecha_vencimiento ? formatearFecha(item.fecha_vencimiento) : 'N/A'}</span>
                                            </div>
                                        </div>
                                        <div class="detail-item" style="border-left: 1px solid #ccc; padding-left: 8px;">
                                            <span class="detail-label">Recepción</span>
                                            <span class="detail-value">${item.detalle?.cotejo?.timestamp_create ? formatDateSystemToDDMMYYYY(item.detalle.cotejo.timestamp_create) : 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div style="font-size: 7px; font-weight: 900; color: #1e293b; text-transform: uppercase; margin-top: 4px; border-top: 1px dashed #ccc; padding-top: 2px;">
                                        Prov: ${item.detalle?.cotejo?.proveedor?.nombre || 'S/P'}
                                    </div>
                                </div>
                                <div class="barcode-container">
                                    <div class="barcode">${encodedBarcode}</div>
                                </div>
                                <div class="footer">
                                    <div class="logistics">
                                        <span class="logistics-badge">${presName}</span>
                                        <span class="logistics-sub">${cantDisplay}</span>
                                    </div>
                                    <div class="bulto-badge">${index + 1}/${bultos}</div>
                                </div>
                            </div>
                        `);
        }).join('')}
                </body>
            </html>
        `;

        iframeDoc.write(html);
        iframeDoc.close();

        // Esperar a que carguen las fuentes antes de imprimir
        iframe.contentWindow.onload = () => {
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                // Eliminar el iframe después de un tiempo para dar tiempo al diálogo de impresión
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
            }, 800);
        };
    };

    return createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-slate-50 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/20">

                {/* Header */}
                <div className="bg-white p-6 border-b flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-50 rounded-2xl text-brand-600">
                            <PackageCheck size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Etiquetas de Tracking</h3>
                            <p className="text-sm text-slate-500 italic">Vista previa antes de imprimir en Zebra 80mm</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content - Preview Scroll Area */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-200/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center justify-items-center">
                        {inventario.flatMap((item) => {
                            const bultos = Math.max(1, Math.floor(item.detalle?.cantidad || 1));
                            const encodedBarcode = encodeCode128(item.tracking_id);
                            const presName = item.detalle?.logistica?.presentacion?.nombre || 'UNIDAD';
                            const isVarWeight = isVariableWeight(presName);
                            const cantDisplay = isVarWeight
                                ? 'Cant: _________________ KG'
                                : `Cant: x${(item.cantidad_actual / (item.detalle?.cantidad || 1)).toFixed(2)} KG`;

                            return Array.from({ length: bultos }).map((_, index) => (
                                <div
                                    key={`${item.id}-${index}`}
                                    className="bg-white shadow-xl border border-gray-200 w-[80mm] h-[50mm] flex flex-col p-4 rounded-sm relative overflow-hidden"
                                    style={{ transform: 'scale(1.1)', margin: '15px' }}
                                >
                                    {/* Header Line */}
                                    <div className="flex justify-between items-start border-b-2 border-black pb-1 mb-1">
                                        <div className="flex flex-col">
                                            <span className="font-black text-[10px] text-slate-900 tracking-tighter">SERCOSYS CORE</span>
                                            {/* <span className="text-[7px] font-bold text-slate-400 uppercase italic">WMS Logistics Unit</span> */}
                                        </div>
                                        <span className="font-mono font-black text-[11px] bg-slate-100 px-2 py-1 rounded-sm">{item.tracking_id}</span>
                                    </div>

                                    {/* Product Info */}
                                    <div className="flex flex-col mb-1">
                                        <div className="font-black text-[11px] leading-tight text-slate-800 uppercase line-clamp-2">
                                            {item.producto?.rubro?.nombre} {item.producto?.marca?.nombre} {item.producto?.variedad}
                                        </div>
                                        <div className="flex justify-between gap-3 text-[8px] font-black text-slate-600 bg-gray-50/80 p-1.5 rounded-sm border border-gray-100">
                                            <div className="flex">
                                                <div className="flex flex-col">
                                                    <span className="text-[6px] text-slate-400 uppercase leading-none mb-0.5">Lote</span>
                                                    <span className="leading-none">{item.lote || 'S/L'}</span>
                                                </div>
                                                <div className="flex flex-col border-l border-gray-200 pl-3">
                                                    <span className="text-[6px] text-slate-400 uppercase leading-none mb-0.5">Vencimiento</span>
                                                    <span className="leading-none">{item.fecha_vencimiento ? formatearFecha(item.fecha_vencimiento) : 'N/A'}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col border-l border-gray-200 pl-3">
                                                <span className="text-[6px] text-slate-400 uppercase leading-none mb-0.5">Recepción</span>
                                                <span className="leading-none">{item.detalle?.cotejo?.timestamp_create ? formatDateSystemToDDMMYYYY(item.detalle.cotejo.timestamp_create) : 'N/A'}</span>
                                            </div>
                                        </div>
                                        <div className="text-[7px] font-black text-brand-900 uppercase tracking-tighter truncate">
                                            Prov: <span className="font-normal">{item.detalle?.cotejo?.proveedor?.nombre || 'S/P'}</span>
                                        </div>
                                    </div>

                                    {/* Central Barcode */}
                                    <div className="flex-1 flex flex-col items-center justify-center -my-0.5">
                                        <div className="text-[38px] leading-none text-black" style={{ fontFamily: "'Libre Barcode 128', cursive", fontWeight: 'normal' }}>
                                            {encodedBarcode}
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="border-t-2 border-black pt-0.5 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black uppercase text-slate-900 leading-none">
                                                {presName}
                                            </span>
                                            <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter">
                                                {cantDisplay}
                                            </span>
                                        </div>
                                        <div className="text-[9px] font-black bg-black text-white px-3 py-1 rounded-full uppercase tracking-widest">
                                            {index + 1}/{bultos}
                                        </div>
                                    </div>
                                </div>
                            ));
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-white p-6 border-t flex items-center justify-end gap-3 sticky bottom-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-brand-900 text-white px-8 py-2.5 rounded-xl font-black shadow-xl shadow-brand-900/20 hover:bg-brand-800 transition-all active:scale-95"
                    >
                        <Printer size={18} />
                        IMPRIMIR AHORA
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default EtiquetasTrackingRecepcionModal;
