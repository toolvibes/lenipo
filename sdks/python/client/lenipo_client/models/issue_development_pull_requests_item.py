from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.issue_development_pull_requests_item_review_type_0 import IssueDevelopmentPullRequestsItemReviewType0
from ..models.issue_development_pull_requests_item_state import IssueDevelopmentPullRequestsItemState
from typing import cast
import datetime






T = TypeVar("T", bound="IssueDevelopmentPullRequestsItem")



@_attrs_define
class IssueDevelopmentPullRequestsItem:
    """ 
        Attributes:
            number (str):
            title (str):
            repository (str):
            url (None | str):
            state (IssueDevelopmentPullRequestsItemState):
            review (IssueDevelopmentPullRequestsItemReviewType0 | None):
            author (None | str):
            updated_at (datetime.datetime):
     """

    number: str
    title: str
    repository: str
    url: None | str
    state: IssueDevelopmentPullRequestsItemState
    review: IssueDevelopmentPullRequestsItemReviewType0 | None
    author: None | str
    updated_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        number = self.number

        title = self.title

        repository = self.repository

        url: None | str
        url = self.url

        state = self.state.value

        review: None | str
        if isinstance(self.review, IssueDevelopmentPullRequestsItemReviewType0):
            review = self.review.value
        else:
            review = self.review

        author: None | str
        author = self.author

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "number": number,
            "title": title,
            "repository": repository,
            "url": url,
            "state": state,
            "review": review,
            "author": author,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        number = d.pop("number")

        title = d.pop("title")

        repository = d.pop("repository")

        def _parse_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        url = _parse_url(d.pop("url"))


        state = IssueDevelopmentPullRequestsItemState(d.pop("state"))




        def _parse_review(data: object) -> IssueDevelopmentPullRequestsItemReviewType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                review_type_0 = IssueDevelopmentPullRequestsItemReviewType0(data)



                return review_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(IssueDevelopmentPullRequestsItemReviewType0 | None, data)

        review = _parse_review(d.pop("review"))


        def _parse_author(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        author = _parse_author(d.pop("author"))


        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        issue_development_pull_requests_item = cls(
            number=number,
            title=title,
            repository=repository,
            url=url,
            state=state,
            review=review,
            author=author,
            updated_at=updated_at,
        )

        return issue_development_pull_requests_item

