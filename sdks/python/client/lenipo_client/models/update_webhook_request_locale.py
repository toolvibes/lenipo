from enum import StrEnum

class UpdateWebhookRequestLocale(StrEnum):
    DE = "de"
    EN = "en"

    def __str__(self) -> str:
        return str(self.value)
