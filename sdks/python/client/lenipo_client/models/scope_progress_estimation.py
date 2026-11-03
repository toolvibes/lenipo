from enum import StrEnum

class ScopeProgressEstimation(StrEnum):
    ISSUECOUNT = "issueCount"
    ORIGINALESTIMATE = "originalEstimate"
    STORYPOINTS = "storyPoints"

    def __str__(self) -> str:
        return str(self.value)
