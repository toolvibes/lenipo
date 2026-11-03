from enum import StrEnum

class TwoFactorStatusPendingType0(StrEnum):
    SETUP = "setup"
    VERIFY = "verify"

    def __str__(self) -> str:
        return str(self.value)
