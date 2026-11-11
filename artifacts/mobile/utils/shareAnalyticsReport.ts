import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { AnalyticsReport } from "@/finance/analyticsTypes";
import { analyticsCSV, analyticsHTML } from "@/finance/analyticsExport";

/** Both exports serialize the exact report the user is viewing, with no new calculation. */
export async function exportAnalyticsReport(report: AnalyticsReport, format: "csv" | "pdf"): Promise<void> {
  const filename = `FinanceApp-${report.query.from}-${report.query.to}-${report.query.currency.replace(/[^a-zA-Z0-9]/g, "")}`;
  if (Platform.OS === "web") {
    if (format === "pdf") {
      const tab = window.open("", "_blank");
      if (!tab) throw new Error("Allow the report window to open, then try PDF again.");
      tab.document.write(analyticsHTML(report)); tab.document.close();
      tab.focus(); tab.print();
    } else {
      const url = URL.createObjectURL(new Blob([analyticsCSV(report)], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `${filename}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return;
  }
  let uri: string;
  if (format === "pdf") uri = (await Print.printToFileAsync({ html: analyticsHTML(report) })).uri;
  else {
    if (!FileSystem.cacheDirectory) throw new Error("Report storage is unavailable.");
    uri = `${FileSystem.cacheDirectory}${filename}.csv`;
    await FileSystem.writeAsStringAsync(uri, analyticsCSV(report), { encoding: FileSystem.EncodingType.UTF8 });
  }
  if (!await Sharing.isAvailableAsync()) throw new Error("Sharing is unavailable on this device.");
  await Sharing.shareAsync(uri, { mimeType: format === "pdf" ? "application/pdf" : "text/csv",
    UTI: format === "pdf" ? "com.adobe.pdf" : "public.comma-separated-values-text", dialogTitle: "FinanceApp financial report" });
}
