from enum import StrEnum

class WebhookFormat(StrEnum):
    MATTERMOST = "mattermost"
    ROCKETCHAT = "rocketchat"
    SLACK = "slack"
    STANDARD = "standard"
    TEAMS = "teams"

    def __str__(self) -> str:
        return str(self.value)
