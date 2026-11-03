from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="AutomationTriggerType6")



@_attrs_define
class AutomationTriggerType6:
    """ 
        Attributes:
            type_ (Literal['sprint-completed']):
     """

    type_: Literal['sprint-completed']





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
        type_ = cast(Literal['sprint-completed'] , d.pop("type"))
        if type_ != 'sprint-completed':
            raise ValueError(f"type must match const 'sprint-completed', got '{type_}'")

        automation_trigger_type_6 = cls(
            type_=type_,
        )

        return automation_trigger_type_6

