from enum import StrEnum

class ServiceDeskSettingsInputCustomerAccess(StrEnum):
    EVERYONE = "everyone"
    LIST = "list"

    def __str__(self) -> str:
        return str(self.value)
