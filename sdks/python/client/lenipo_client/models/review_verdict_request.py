from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.review_verdict_request_verdict import ReviewVerdictRequestVerdict






T = TypeVar("T", bound="ReviewVerdictRequest")



@_attrs_define
class ReviewVerdictRequest:
    """ 
        Attributes:
            verdict (ReviewVerdictRequestVerdict):
            body (str):
     """

    verdict: ReviewVerdictRequestVerdict
    body: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        verdict = self.verdict.value

        body = self.body


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "verdict": verdict,
            "body": body,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        verdict = ReviewVerdictRequestVerdict(d.pop("verdict"))




        body = d.pop("body")

        review_verdict_request = cls(
            verdict=verdict,
            body=body,
        )


        review_verdict_request.additional_properties = d
        return review_verdict_request

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
