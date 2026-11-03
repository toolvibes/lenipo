from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="AutomationTriggerType1")



@_attrs_define
class AutomationTriggerType1:
    """ 
        Attributes:
            type_ (Literal['issue-updated']):
     """

    type_: Literal['issue-updated']





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['issue-updated'] , d.pop("type"))
        if type_ != 'issue-updated':
            raise ValueError(f"type must match const 'issue-updated', got '{type_}'")

        automation_trigger_type_1 = cls(
            type_=type_,
        )

        return automation_trigger_type_1

