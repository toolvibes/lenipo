from enum import StrEnum

class WebhookLastDeliveryType0Status(StrEnum):
    FAILED = "failed"
    PENDING = "pending"
    SUCCEEDED = "succeeded"

    def __str__(self) -> str:
        return str(self.value)
