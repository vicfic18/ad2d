

export interface BatchConfig {
  templateSvgString: string;
  data: Record<string, string>[];
  fileNamePattern: string;
  mapping: Record<string, string>; // CSV column -> SVG placeholder
  onProgress: (current: number, total: number) => void;
  onComplete: (zipBlob: Blob) => void;
  onError: (err: Error) => void;
}

export async function generateBatch({
  templateSvgString,
  data,
  fileNamePattern,
  mapping,
  onProgress,
  onComplete,
  onError,
}: BatchConfig) {
  try {
    const [{ jsPDF }, { svg2pdf }, { default: JSZip }] = await Promise.all([
      import('jspdf'),
      import('svg2pdf.js'),
      import('jszip'),
    ]);

    const zip = new JSZip();
    const total = data.length;

    for (let i = 0; i < total; i++) {
      const row = data[i];

      // 1. Process SVG string
      let processedSvgStr = templateSvgString;
      
      // We do naive regex replacement on the SVG string
      // using the mapping definition: Placeholder -> Column
      for (const [placeholder, column] of Object.entries(mapping)) {
        if (!column) continue;
        const val = row[column] || '';
        // Replace all instances of this specific placeholder
        const regex = new RegExp(placeholder, 'g');
        processedSvgStr = processedSvgStr.replace(regex, val);
      }

      // 2. Parse into DOM
      const parser = new DOMParser();
      const doc = parser.parseFromString(processedSvgStr, 'image/svg+xml');
      const svgElement = doc.documentElement as any as SVGElement;

      // Extract width and height
      const widthMatch = svgElement.getAttribute('width');
      const heightMatch = svgElement.getAttribute('height');
      const viewBox = svgElement.getAttribute('viewBox');
      
      let width = 210; // A4 default mm
      let height = 297;
      
      if (widthMatch && heightMatch) {
        width = parseFloat(widthMatch);
        height = parseFloat(heightMatch);
      } else if (viewBox) {
        const parts = viewBox.split(' ').map(parseFloat);
        width = parts[2] - parts[0];
        height = parts[3] - parts[1];
      }

      // We approximate size from pt/px to mm or let jsPDF decide based on pt.
      // Usually SVGs are defined in px/pt. Let's create PDF in 'pt'.
      const pdf = new jsPDF({
        orientation: width > height ? 'l' : 'p',
        unit: 'pt',
        format: [width, height],
      });

      // 3. Render PDF
      await svg2pdf(svgElement, pdf, {
        x: 0,
        y: 0,
        width: width,
        height: height
      });

      // 4. Generate Output Name
      let currentFileName = fileNamePattern || `document_${i + 1}`;
      for (const column of Object.keys(row)) {
         currentFileName = currentFileName.replace(new RegExp(`%${column}%`, 'g'), row[column] || '');
      }
      if (!currentFileName.toLowerCase().endsWith('.pdf')) {
         currentFileName += '.pdf';
      }

      // 5. Add to Zip
      zip.file(currentFileName, pdf.output('blob'));

      // Report progress
      onProgress(i + 1, total);

      // Yield execution to the main thread to allow UI updates
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // 6. Finalize Zip
    const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
      // metadata.percent
    });
    
    onComplete(zipBlob);

  } catch (err: any) {
    onError(err);
  }
}
