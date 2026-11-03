from enum import StrEnum

class PageApprovalMode(StrEnum):
    OFF = "off"
    ON = "on"
    SPACE = "space"

    def __str__(self) -> str:
        return str(self.value)
