package com.icaro.coffeeapp.service;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;

@Service
public class ExcelService {

    public byte[] generarExcelDetalle(List<Map<String, Object>> datos) throws Exception {

        try (XSSFWorkbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = wb.createSheet("Detalle de Órdenes");

            // ── Estilos ──────────────────────────────────────────────
            CellStyle estiloTitulo = wb.createCellStyle();
            Font fuenteTitulo = wb.createFont();
            fuenteTitulo.setBold(true);
            fuenteTitulo.setFontHeightInPoints((short) 14);
            estiloTitulo.setFont(fuenteTitulo);
            estiloTitulo.setAlignment(HorizontalAlignment.CENTER);

            CellStyle estiloHeader = wb.createCellStyle();
            Font fuenteHeader = wb.createFont();
            fuenteHeader.setBold(true);
            fuenteHeader.setColor(IndexedColors.WHITE.getIndex());
            estiloHeader.setFont(fuenteHeader);
            estiloHeader.setFillForegroundColor(IndexedColors.DARK_TEAL.getIndex());
            estiloHeader.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            estiloHeader.setAlignment(HorizontalAlignment.CENTER);
            estiloHeader.setBorderBottom(BorderStyle.THIN);

            CellStyle estiloMoneda = wb.createCellStyle();
            DataFormat fmt = wb.createDataFormat();
            estiloMoneda.setDataFormat(fmt.getFormat("$#,##0.00"));

            CellStyle estiloFila = wb.createCellStyle();
            estiloFila.setBorderBottom(BorderStyle.HAIR);

            CellStyle estiloFilaAlt = wb.createCellStyle();
            estiloFilaAlt.setFillForegroundColor(IndexedColors.LIGHT_TURQUOISE.getIndex());
            estiloFilaAlt.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            estiloFilaAlt.setBorderBottom(BorderStyle.HAIR);

            CellStyle estiloMonedaAlt = wb.createCellStyle();
            estiloMonedaAlt.cloneStyleFrom(estiloFilaAlt);
            estiloMonedaAlt.setDataFormat(fmt.getFormat("$#,##0.00"));

            // ── Fila 0: Título ────────────────────────────────────────
            Row rowTitulo = sheet.createRow(0);
            rowTitulo.setHeightInPoints(22);
            Cell cellTitulo = rowTitulo.createCell(0);
            cellTitulo.setCellValue("Detalle de Órdenes — " + java.time.LocalDate.now());
            cellTitulo.setCellStyle(estiloTitulo);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 5));

            // ── Fila 1: Encabezados ───────────────────────────────────
            String[] headers = {"#", "ID Orden", "Hora Cierre", "Resumen", "Método de Pago", "Total"};
            Row rowHeader = sheet.createRow(1);
            rowHeader.setHeightInPoints(18);
            for (int i = 0; i < headers.length; i++) {
                Cell c = rowHeader.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(estiloHeader);
            }

            // ── Filas de datos ────────────────────────────────────────
            int rowNum = 2;
            int contador = 1;
            for (Map<String, Object> row : datos) {
                Row fila = sheet.createRow(rowNum);
                boolean esAlt = (rowNum % 2 == 0);

                CellStyle csBase   = esAlt ? estiloFilaAlt  : estiloFila;
                CellStyle csMoney  = esAlt ? estiloMonedaAlt : estiloMoneda;

                fila.createCell(0).setCellValue(contador++);
                fila.createCell(1).setCellValue(toStr(row.get("id_orden")));

                String hora = toStr(row.get("hora_cierre")).replace("T", " ");
                if (hora.length() > 19) hora = hora.substring(0, 19);
                fila.createCell(2).setCellValue(hora);

                fila.createCell(3).setCellValue(toStr(row.get("resumen")));
                fila.createCell(4).setCellValue(toStr(row.get("metodo_pago")));

                Cell celdaTotal = fila.createCell(5);
                Object totalObj = row.get("total");
                if (totalObj != null) {
                    celdaTotal.setCellValue(Double.parseDouble(totalObj.toString()));
                    celdaTotal.setCellStyle(csMoney);
                }

                // Aplicar estilo base a las demás celdas
                for (int c = 0; c <= 4; c++) {
                    fila.getCell(c).setCellStyle(csBase);
                }

                rowNum++;
            }

            // ── Anchos de columna ─────────────────────────────────────
            sheet.setColumnWidth(0, 1800);   // #
            sheet.setColumnWidth(1, 3000);   // ID
            sheet.setColumnWidth(2, 5500);   // Hora
            sheet.setColumnWidth(3, 14000);  // Resumen
            sheet.setColumnWidth(4, 4500);   // Pago
            sheet.setColumnWidth(5, 4000);   // Total

            // ── AutoFilter ────────────────────────────────────────────
            sheet.setAutoFilter(new CellRangeAddress(1, rowNum - 1, 0, 5));

            wb.write(out);
            return out.toByteArray();
        }
    }

    private String toStr(Object val) {
        return val != null ? val.toString() : "—";
    }
}