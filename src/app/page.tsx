"use client";

import React, { useState, useEffect, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertTriangle, Play, Download, Settings, FileArchive, Loader2 } from "lucide-react";
import { generateBatch } from "@/lib/pdf-generator";

type Step = 'UPLOAD' | 'MAP' | 'GENERATE' | 'DONE';

export default function Home() {
  const [step, setStep] = useState<Step>('UPLOAD');
  const [dataKeys, setDataKeys] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [dataFilename, setDataFilename] = useState<string>('');

  const [svgTemplateStr, setSvgTemplateStr] = useState<string>('');
  const [svgPlaceholders, setSvgPlaceholders] = useState<string[]>([]);
  const [svgFilename, setSvgFilename] = useState<string>('');

  const [mapping, setMapping] = useState<Record<string, string>>({}); // CSV Header -> SVG Placeholder
  const [fileNamePattern, setFileNamePattern] = useState<string>('document_%NAME%');

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [zipUrl, setZipUrl] = useState<string | null>(null);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingData, setIsDraggingData] = useState(false);
  const [isDraggingSvg, setIsDraggingSvg] = useState(false);

  // DATA UPLOAD HANDLER
  const processDataFile = async (file: File) => {
    setDataFilename(file.name);

    if (file.name.endsWith('.csv')) {
      const { default: Papa } = await import('papaparse');
      Papa.parse(file, {
        complete: (results) => {
          const rows = results.data as Record<string, string>[];
          if (rows.length > 0) {
            setParsedData(rows);
            setDataKeys(Object.keys(rows[0]));
          }
        },
        header: true,
        skipEmptyLines: true,
      });
    } else if (file.name.match(/\.xlsx?$/)) {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet) as Record<string, string>[];
      if (json.length > 0) {
        setParsedData(json);
        setDataKeys(Object.keys(json[0]));
      }
    }
  };

  const handleDataUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processDataFile(file);
  };

  // SVG UPLOAD HANDLER
  const processSvgFile = async (file: File) => {
    setSvgFilename(file.name);

    const text = await file.text();

    // Parse to manipulate fonts
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');

    // Enforce standard fonts and find placeholders
    const textNodes = doc.querySelectorAll('text, tspan');
    const placeholders: Set<string> = new Set();

    textNodes.forEach(node => {
      // OVERRIDE FONT
      node.setAttribute('font-family', 'Helvetica');
      if ((node as HTMLElement).style) {
        (node as HTMLElement).style.fontFamily = 'Helvetica';
      }

      // FIND PLACEHOLDERS LIKE %NAME% or $NAME
      const content = node.textContent || '';
      const matches = content.match(/%([^%]+)%/g);
      if (matches) {
        matches.forEach(m => placeholders.add(m));
      }
    });

    const rootSvg = doc.documentElement;
    // ensure standard xml namespace
    if (!rootSvg.getAttribute('xmlns')) {
      rootSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }

    const serializer = new XMLSerializer();
    const finalStr = serializer.serializeToString(doc);

    setSvgTemplateStr(finalStr);
    setSvgPlaceholders(Array.from(placeholders));
  };

  const handleSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processSvgFile(file);
  };

  // Drag and Drop helpers
  const handleDrag = (e: React.DragEvent, setter: (val: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setter(true);
    } else if (e.type === "dragleave") {
      setter(false);
    }
  };

  const handleDrop = (e: React.DragEvent, processor: (file: File) => void, setter: (val: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setter(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processor(file);
  };

  // Generate preview of first row
  useEffect(() => {
    if (step === 'MAP' && svgTemplateStr && parsedData.length > 0 && previewContainerRef.current) {
      let previewStr = svgTemplateStr;
      const firstRow = parsedData[0];

      // Apply current mappings: Placeholder -> Column
      for (const [ph, col] of Object.entries(mapping)) {
        if (col) {
          const regex = new RegExp(ph, 'g');
          previewStr = previewStr.replace(regex, firstRow[col] || '');
        }
      }

      previewContainerRef.current.innerHTML = previewStr;

      // ensure svg fits perfectly
      const svgEl = previewContainerRef.current.querySelector('svg');
      if (svgEl) {
        svgEl.style.width = '100%';
        svgEl.style.height = 'auto';
      }
    }
  }, [step, svgTemplateStr, parsedData, mapping]);

  // Handle generation start
  const handleGenerate = () => {
    setStep('GENERATE');
    setIsGenerating(true);
    setProgress(0);

    generateBatch({
      templateSvgString: svgTemplateStr,
      data: parsedData,
      fileNamePattern,
      mapping,
      onProgress: (current, total) => {
        setProgress(Math.round((current / total) * 100));
      },
      onComplete: (zipBlob) => {
        setIsGenerating(false);
        setStep('DONE');
        const url = URL.createObjectURL(zipBlob);
        setZipUrl(url);
      },
      onError: (err) => {
        alert("Error during generation: " + err.message);
        setIsGenerating(false);
        setStep('MAP');
      }
    });
  };

  // Switch to mapper when files ready
  useEffect(() => {
    if (step === 'UPLOAD' && parsedData.length > 0 && svgTemplateStr) {
      setStep('MAP');
    }
  }, [parsedData, svgTemplateStr, step]);


  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-8 selection:bg-black selection:text-white">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 border-b-2 border-primary pb-6 flex justify-between items-center bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2">
          <div>
            <h1 className="text-4xl font-black tracking-tighter">aD2D</h1>
            <p className="text-sm font-bold uppercase tracking-wider text-gray-500 mt-1">Generate certificates, letters, tickets, etc from a spreadsheet and SVG template directly in your browser.</p>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map(s => (
              <div key={s} className={`w-8 h-8 rounded-none border-2 border-primary flex items-center justify-center font-bold ${(step === 'UPLOAD' && s === 1) || (step === 'MAP' && s === 2) || ((step === 'GENERATE' || step === 'DONE') && s === 3)
                ? 'bg-primary text-white' : 'bg-white text-primary'
                }`}>
                {s}
              </div>
            ))}
          </div>
        </header>

        {step === 'UPLOAD' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div
              onDragEnter={(e) => handleDrag(e, setIsDraggingData)}
              onDragOver={(e) => handleDrag(e, setIsDraggingData)}
              onDragLeave={(e) => handleDrag(e, setIsDraggingData)}
              onDrop={(e) => handleDrop(e, processDataFile, setIsDraggingData)}
              className={`bg-white border-2 border-primary p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center text-center min-h-[300px] relative transition-all hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] ${isDraggingData ? 'bg-gray-100 scale-[1.02]' : ''}`}
            >
              <input type="file" accept=".csv, .xlsx, .xls" onChange={handleDataUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              {dataFilename ? (
                <>
                  <CheckCircle className="w-16 h-16 mb-4 text-green-600" />
                  <h2 className="text-2xl font-black">{dataFilename}</h2>
                  <p className="font-medium mt-2">{parsedData.length} records parsed</p>
                </>
              ) : (
                <>
                  <Upload className={`w-16 h-16 mb-4 transition-transform ${isDraggingData ? 'scale-125' : ''}`} />
                  <h2 className="text-2xl font-black uppercase">Drop Spreadsheet</h2>
                  <p className="font-medium mt-2 text-gray-600 uppercase tracking-tighter">CSV or Excel files</p>
                </>
              )}
            </div>

            <div
              onDragEnter={(e) => handleDrag(e, setIsDraggingSvg)}
              onDragOver={(e) => handleDrag(e, setIsDraggingSvg)}
              onDragLeave={(e) => handleDrag(e, setIsDraggingSvg)}
              onDrop={(e) => handleDrop(e, processSvgFile, setIsDraggingSvg)}
              className={`bg-white border-2 border-primary p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center text-center min-h-[300px] relative transition-all hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] ${isDraggingSvg ? 'bg-gray-100 scale-[1.02]' : ''}`}
            >
              <input type="file" accept=".svg" onChange={handleSvgUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              {svgFilename ? (
                <>
                  <CheckCircle className="w-16 h-16 mb-4 text-green-600" />
                  <h2 className="text-2xl font-black">{svgFilename}</h2>
                  <p className="font-medium mt-2">{svgPlaceholders.length} placeholders found</p>
                </>
              ) : (
                <>
                  <FileText className={`w-16 h-16 mb-4 transition-transform ${isDraggingSvg ? 'scale-125' : ''}`} />
                  <h2 className="text-2xl font-black uppercase">Drop Template</h2>
                  <p className="font-medium mt-2 text-gray-600 uppercase tracking-tighter">SVG vector format</p>
                </>
              )}

              <div className="absolute top-0 right-0 p-2 opacity-50"><AlertTriangle className="w-5 h-5" /></div>
            </div>

            <div className="col-span-1 md:col-span-2 bg-yellow-100 border-2 border-yellow-400 p-4 flex gap-4 items-center">
              <AlertTriangle className="w-8 h-8 text-yellow-600 shrink-0" />
              <p className="text-sm font-bold">
                FONTS OVERRIDE WARNING: For PDF rendering, all custom fonts within the uploaded SVG template will be overwritten to standard PDF-supported fonts (e.g., Helvetica).
              </p>
            </div>

            <div className="col-span-1 md:col-span-2 pt-10 border-t-2 border-primary">
              <h2 className="text-3xl font-black uppercase mb-8 tracking-tighter">How it works</h2>

              <div className="mb-12 bg-white border-2 border-primary p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row md:items-center gap-6">
                <div className="bg-primary text-white font-black text-xs px-2 py-1 uppercase tracking-widest self-start md:self-auto shrink-0">Template Setup</div>
                <p className="text-lg font-bold leading-tight text-gray-700">
                  Create your SVG in any vector tool (Inkscape, Figma etc.) and add text nodes with <span className="text-black underline underline-offset-4 decoration-2">%PLACEHOLDER%</span> syntax. These will be auto-detected for mapping.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-12">
                {[
                  { step: 1, title: 'Upload Files', desc: 'Select your CSV/Excel spreadsheet and SVG template.', img: '/example/1.png' },
                  { step: 2, title: 'Map Fields', desc: 'Link your dataset columns to the template placeholders.', img: '/example/2.png' },
                  { step: 3, title: 'Download ZIP', desc: 'Batch generate all PDFs locally and export as an archive.', img: '/example/3.png' }
                ].map((item) => (
                  <div key={item.step} className="group">
                    <div className="relative mb-6 border-2 border-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-gray-100 aspect-video flex items-center justify-center">
                      <img src={item.img} alt={item.title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                      <div className="absolute top-0 left-0 bg-primary text-white font-black text-2xl w-10 h-10 flex items-center justify-center">
                        {item.step}
                      </div>
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight mb-2">{item.title}</h3>
                    <p className="font-bold text-sm text-gray-500 leading-tight">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'MAP' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-8">
              <div className="bg-white border-2 border-primary p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-xl font-black border-b-2 border-primary pb-2 mb-6 flex items-center gap-2">
                  <Settings className="w-5 h-5" /> FIELD MAPPINGS
                </h3>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {svgPlaceholders.map(placeholder => (
                    <div key={placeholder} className="flex flex-col md:flex-row md:items-center justify-between p-3 border-2 border-gray-200">
                      <span className="font-bold flex-1 truncate" title={placeholder}>{placeholder}</span>
                      <ArrowRight className="w-4 h-4 mx-2 hidden md:block text-gray-400 rotate-180 md:rotate-0" />
                      <select
                        className="border-2 border-primary p-2 font-bold focus:outline-none focus:ring-0 bg-transparent min-w-[200px]"
                        value={mapping[placeholder] || ''}
                        onChange={(e) => setMapping(prev => ({ ...prev, [placeholder]: e.target.value }))}
                      >
                        <option value="">IGNORE PLACEHOLDER</option>
                        {dataKeys.map(key => (
                          <option key={key} value={key}>{key}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border-2 border-primary p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-xl font-black border-b-2 border-primary pb-2 mb-4">FILE NAMING SCHEME</h3>
                <p className="text-xs font-bold text-gray-500 mb-2">Use %COLUMN_NAME% variables from your dataset</p>
                <input
                  type="text"
                  value={fileNamePattern}
                  onChange={(e) => setFileNamePattern(e.target.value)}
                  className="w-full border-2 border-primary p-3 font-bold focus:outline-none placeholder:text-gray-300"
                  placeholder="E.g., doc_%id%.pdf"
                />
              </div>

              <button
                onClick={handleGenerate}
                className="bg-primary text-white font-black text-xl p-6 border-2 border-primary hover:bg-white hover:text-primary transition-colors shadow-[8px_8px_0px_0px_rgba(100,100,100,1)] active:shadow-none active:translate-y-2 active:translate-x-2 flex justify-center items-center gap-3"
              >
                <Play className="fill-current w-6 h-6" /> START BATCH RENDER
              </button>
            </div>

            <div className="bg-white border-2 border-primary p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col">
              <h3 className="text-xl font-black border-b-2 border-primary pb-2 mb-6">PREVIEW</h3>
              <div className="flex-1 border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center p-4 overflow-hidden relative">
                <div ref={previewContainerRef} className="max-w-full max-h-[600px] overflow-auto shadow-lg bg-white border border-gray-100 p-2" />
                <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold py-1 px-2">ROW 1</div>
              </div>
            </div>
          </div>
        )}

        {(step === 'GENERATE' || step === 'DONE') && (
          <div className="bg-white border-2 border-primary p-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center flex flex-col items-center max-w-2xl mx-auto mt-12">

            {step === 'GENERATE' ? (
              <>
                <Loader2 className="w-20 h-20 animate-spin text-primary mb-6" />
                <h2 className="text-3xl font-black mb-4">PROCESSING BATCH...</h2>

                <div className="w-full h-8 border-2 border-primary mt-8 relative">
                  <div className="h-full bg-primary transition-all duration-300 left-0 top-0" style={{ width: `${progress}%` }} />
                  <div className="absolute inset-0 flex items-center justify-center mix-blend-difference font-black text-white">
                    {progress}%
                  </div>
                </div>
                <p className="font-bold mt-4 text-gray-500">Generating PDFs locally in your browser. Do not close this tab.</p>
              </>
            ) : (
              <>
                <FileArchive className="w-24 h-24 text-primary mb-6" />
                <h2 className="text-3xl font-black mb-2">GENERATION COMPLETE</h2>
                <p className="font-bold text-gray-500 mb-8">{parsedData.length} records successfully compiled</p>

                <a
                  href={zipUrl || '#'}
                  download="generated_documents.zip"
                  className="inline-flex bg-primary text-white font-black text-xl px-12 py-6 border-2 border-primary hover:bg-white hover:text-primary transition-colors shadow-[8px_8px_0px_0px_rgba(100,100,100,1)] active:shadow-none active:translate-y-2 active:translate-x-2 justify-center items-center gap-3"
                >
                  <Download className="w-6 h-6" /> DOWNLOAD ZIP ARCHIVE
                </a>

                <div className="flex flex-col gap-4 mt-8">
                  <button
                    onClick={() => setStep('MAP')}
                    className="text-sm font-bold underline hover:text-gray-500 decoration-2 underline-offset-4"
                  >
                    BACK TO CONFIGURATION
                  </button>
                  <button
                    onClick={() => {
                      setStep('UPLOAD');
                      setDataKeys([]);
                      setParsedData([]);
                      setDataFilename('');
                      setSvgFilename('');
                      setSvgTemplateStr('');
                      setZipUrl(null);
                    }}
                    className="text-sm font-bold underline hover:text-gray-500 decoration-2 underline-offset-4"
                  >
                    START NEW BATCH
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>

      <footer className="max-w-6xl mx-auto mt-20 border-t-2 border-primary pt-8 pb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 opacity-60 hover:opacity-100 transition-opacity">
        <div className="flex flex-col gap-2">
          <div className="font-black text-xs uppercase tracking-[0.2em]">
            AD2D • AUTOMATIC DATA TO DOCUMENT
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
            OPEN SOURCE PROJECT • LICENSED UNDER AGPL • <a href="https://github.com/vicfic18/ad2d" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-black">GITHUB.COM/VICFIC18/AD2D</a>
          </div>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest md:text-right leading-relaxed">
          MADE BY VARGHESE K JAMES<br />
          &copy; 2026 • PRIVACY FIRST • FULLY LOCAL
        </div>
      </footer>
    </div>
  );
}

// Sub-component stub
function ArrowRight(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
