from enum import StrEnum

class IssueExportRequestFormat(StrEnum):
    CSV = "csv"
    JSON = "json"
    XLSX = "xlsx"

    def __str__(self) -> str:
        return str(self.value)
