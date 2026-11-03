from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.burndown_point_type import BurndownPointType
from typing import cast
import datetime






T = TypeVar("T", bound="BurndownPoint")



@_attrs_define
class BurndownPoint:
    """ 
        Attributes:
            at (datetime.datetime):
            type_ (BurndownPointType):
            issue_key (None | str):
            delta (float):
            remaining (float):
     """

    at: datetime.datetime
    type_: BurndownPointType
    issue_key: None | str
    delta: float
    remaining: float





    def to_dict(self) -> dict[str, Any]:
        at = self.at.isoformat()

        type_ = self.type_.value

        issue_key: None | str
        issue_key = self.issue_key

        delta = self.delta

        remaining = self.remaining


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "at": at,
            "type": type_,
            "issueKey": issue_key,
            "delta": delta,
            "remaining": remaining,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        at = datetime.datetime.fromisoformat(d.pop("at"))




        type_ = BurndownPointType(d.pop("type"))




        def _parse_issue_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        issue_key = _parse_issue_key(d.pop("issueKey"))


        delta = d.pop("delta")

        remaining = d.pop("remaining")

        burndown_point = cls(
            at=at,
            type_=type_,
            issue_key=issue_key,
            delta=delta,
            remaining=remaining,
        )

        return burndown_point

