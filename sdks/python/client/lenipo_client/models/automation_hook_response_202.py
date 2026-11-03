from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="AutomationHookResponse202")



@_attrs_define
class AutomationHookResponse202:
    """ 
        Attributes:
            queued (int):
     """

    queued: int





    def to_dict(self) -> dict[str, Any]:
        queued = self.queued


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "queued": queued,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        queued = d.pop("queued")

        automation_hook_response_202 = cls(
            queued=queued,
        )

        return automation_hook_response_202

