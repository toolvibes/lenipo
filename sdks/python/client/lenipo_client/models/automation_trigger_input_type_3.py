from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from typing import Literal, cast






T = TypeVar("T", bound="AutomationTriggerInputType3")



@_attrs_define
class AutomationTriggerInputType3:
    """ 
        Attributes:
            type_ (Literal['field-changed']):
            fields (list[str]):
     """

    type_: Literal['field-changed']
    fields: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        fields = self.fields




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
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


        automation_trigger_input_type_3 = cls(
            type_=type_,
            fields=fields,
        )


        automation_trigger_input_type_3.additional_properties = d
        return automation_trigger_input_type_3

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
