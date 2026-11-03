from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="ReviewRequestPullRequestType0")



@_attrs_define
class ReviewRequestPullRequestType0:
    """ 
        Attributes:
            title (str):
            url (None | str):
            state (str):
            review (None | str):
     """

    title: str
    url: None | str
    state: str
    review: None | str





    def to_dict(self) -> dict[str, Any]:
        title = self.title

        url: None | str
        url = self.url

        state = self.state

        review: None | str
        review = self.review


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "title": title,
            "url": url,
            "state": state,
            "review": review,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        title = d.pop("title")

        def _parse_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        url = _parse_url(d.pop("url"))


        state = d.pop("state")

        def _parse_review(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        review = _parse_review(d.pop("review"))


        review_request_pull_request_type_0 = cls(
            title=title,
            url=url,
            state=state,
            review=review,
        )

        return review_request_pull_request_type_0

