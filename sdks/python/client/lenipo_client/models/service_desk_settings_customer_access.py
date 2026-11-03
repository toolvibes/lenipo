from enum import StrEnum

class ServiceDeskSettingsCustomerAccess(StrEnum):
    EVERYONE = "everyone"
    LIST = "list"

    def __str__(self) -> str:
        return str(self.value)
