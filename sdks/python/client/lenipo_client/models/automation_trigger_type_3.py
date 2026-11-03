from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from typing import Literal, cast






T = TypeVar("T", bound="AutomationTriggerType3")



@_attrs_define
class AutomationTriggerType3:
    """ 
        Attributes:
            type_ (Literal['field-changed']):
            fields (list[str]):
     """

    type_: Literal['field-changed']
    fields: list[str]





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        fields = self.fields




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "fields": fields,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['field-changed'] , d.pop("type"))
        if type_ != 'field-changed':
            raise ValueError(f"type must match const 'field-changed', got '{type_}'")

        fields = cast(list[str], d.pop("fields"))


        automation_trigger_type_3 = cls(
            type_=type_,
            fields=fields,
        )

        return automation_trigger_type_3

