from enum import StrEnum

class GitProvider(StrEnum):
    BITBUCKET = "bitbucket"
    GITEA = "gitea"
    GITHUB = "github"
    GITLAB = "gitlab"

    def __str__(self) -> str:
        return str(self.value)
