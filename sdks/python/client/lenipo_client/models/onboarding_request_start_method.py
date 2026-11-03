from enum import StrEnum

class OnboardingRequestStartMethod(StrEnum):
    KANBAN = "kanban"
    LORE = "lore"
    SCRUM = "scrum"

    def __str__(self) -> str:
        return str(self.value)
