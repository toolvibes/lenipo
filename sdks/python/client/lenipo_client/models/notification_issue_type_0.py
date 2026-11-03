from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="NotificationIssueType0")



@_attrs_define
class NotificationIssueType0:
    """ 
        Attributes:
            key (str):
            summary (str):
     """

    key: str
    summary: str





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        summary = self.summary


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "summary": summary,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        summary = d.pop("summary")

        notification_issue_type_0 = cls(
            key=key,
            summary=summary,
        )

        return notification_issue_type_0

