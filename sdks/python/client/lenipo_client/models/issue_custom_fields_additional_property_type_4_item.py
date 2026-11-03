from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="IssueCustomFieldsAdditionalPropertyType4Item")



@_attrs_define
class IssueCustomFieldsAdditionalPropertyType4Item:
    """ 
        Attributes:
            id (UUID):
            value (str):
     """

    id: UUID
    value: str





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        value = self.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "value": value,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        value = d.pop("value")

        issue_custom_fields_additional_property_type_4_item = cls(
            id=id,
            value=value,
        )

        return issue_custom_fields_additional_property_type_4_item

