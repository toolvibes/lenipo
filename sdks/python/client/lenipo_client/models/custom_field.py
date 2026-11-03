from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.custom_field_type import CustomFieldType
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.custom_field_option import CustomFieldOption





T = TypeVar("T", bound="CustomField")



@_attrs_define
class CustomField:
    """ 
        Attributes:
            id (UUID):
            number (int):
            name (str):
            description (str):
            type_ (CustomFieldType):
            options (list[CustomFieldOption]):
            archived (bool):
     """

    id: UUID
    number: int
    name: str
    description: str
    type_: CustomFieldType
    options: list[CustomFieldOption]
    archived: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.custom_field_option import CustomFieldOption # noqa: PLC0415
        id = str(self.id)

        number = self.number

        name = self.name

        description = self.description

        type_ = self.type_.value

        options = []
        for options_item_data in self.options:
            options_item = options_item_data.to_dict()
            options.append(options_item)



        archived = self.archived


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "number": number,
            "name": name,
            "description": description,
            "type": type_,
            "options": options,
            "archived": archived,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.custom_field_option import CustomFieldOption # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        number = d.pop("number")

        name = d.pop("name")

        description = d.pop("description")

        type_ = CustomFieldType(d.pop("type"))




        options = []
        _options = d.pop("options")
        for options_item_data in (_options):
            options_item = CustomFieldOption.from_dict(options_item_data)



            options.append(options_item)


        archived = d.pop("archived")

        custom_field = cls(
            id=id,
            number=number,
            name=name,
            description=description,
            type_=type_,
            options=options,
            archived=archived,
        )

        return custom_field

