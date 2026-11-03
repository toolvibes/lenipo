from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.automation_run_log_item_level import AutomationRunLogItemLevel






T = TypeVar("T", bound="AutomationRunLogItem")



@_attrs_define
class AutomationRunLogItem:
    """ 
        Attributes:
            level (AutomationRunLogItemLevel):
            message (str):
     """

    level: AutomationRunLogItemLevel
    message: str





    def to_dict(self) -> dict[str, Any]:
        level = self.level.value

        message = self.message


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "level": level,
            "message": message,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        level = AutomationRunLogItemLevel(d.pop("level"))




        message = d.pop("message")

        automation_run_log_item = cls(
            level=level,
            message=message,
        )

        return automation_run_log_item

