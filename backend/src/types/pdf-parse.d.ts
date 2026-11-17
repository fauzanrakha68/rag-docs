declare module "pdf-parse/lib/pdf-parse.js" {
    const pdfParse: (data: Buffer, options?: any) => Promise<any>;
    export default pdfParse;
  }