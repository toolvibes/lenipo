from enum import StrEnum

class VelocityEstimation(StrEnum):
    ISSUECOUNT = "issueCount"
    ORIGINALESTIMATE = "originalEstimate"
    STORYPOINTS = "storyPoints"

    def __str__(self) -> str:
        return str(self.value)
