from enum import StrEnum

class BurndownEstimation(StrEnum):
    ISSUECOUNT = "issueCount"
    ORIGINALESTIMATE = "originalEstimate"
    STORYPOINTS = "storyPoints"

    def __str__(self) -> str:
        return str(self.value)
