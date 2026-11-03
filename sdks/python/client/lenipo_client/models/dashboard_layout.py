from enum import StrEnum

class DashboardLayout(StrEnum):
    ONE = "one"
    THREE = "three"
    TWO = "two"
    WIDE_LEFT = "wide-left"

    def __str__(self) -> str:
        return str(self.value)
