from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="GadgetConfigInputType9")



@_attrs_define
class GadgetConfigInputType9:
    """ 
        Attributes:
            type_ (Literal['text']):
            markdown (str):
     """

    type_: Literal['text']
    markdown: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        markdown = self.markdown


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "markdown": markdown,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['text'] , d.pop("type"))
        if type_ != 'text':
            raise ValueError(f"type must match const 'text', got '{type_}'")

        markdown = d.pop("markdown")

        gadget_config_input_type_9 = cls(
            type_=type_,
            markdown=markdown,
        )


        gadget_config_input_type_9.additional_properties = d
        return gadget_config_input_type_9

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
