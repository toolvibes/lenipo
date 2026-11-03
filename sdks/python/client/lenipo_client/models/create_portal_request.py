from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.create_portal_request_custom_fields import CreatePortalRequestCustomFields
  from ..models.rich_text import RichText
  from ..models.rich_text_input_type_1 import RichTextInputType1





T = TypeVar("T", bound="CreatePortalRequest")



@_attrs_define
class CreatePortalRequest:
    """ 
        Attributes:
            request_type_id (UUID):
            summary (str):
            description (RichText | RichTextInputType1 | Unset):
            priority (str | Unset):
            due_date (datetime.date | Unset):
            custom_fields (CreatePortalRequestCustomFields | Unset):
     """

    request_type_id: UUID
    summary: str
    description: RichText | RichTextInputType1 | Unset = UNSET
    priority: str | Unset = UNSET
    due_date: datetime.date | Unset = UNSET
    custom_fields: CreatePortalRequestCustomFields | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_portal_request_custom_fields import CreatePortalRequestCustomFields # noqa: PLC0415
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.rich_text_input_type_1 import RichTextInputType1 # noqa: PLC0415
        request_type_id = str(self.request_type_id)

        summary = self.summary

        description: dict[str, Any] | Unset
        if isinstance(self.description, Unset):
            description = UNSET
        elif isinstance(self.description, RichText):
            description = self.description.to_dict()
        else:
            description = self.description.to_dict()


        priority = self.priority

        due_date: str | Unset = UNSET
        if not isinstance(self.due_date, Unset):
            due_date = self.due_date.isoformat()

        custom_fields: dict[str, Any] | Unset = UNSET
        if not isinstance(self.custom_fields, Unset):
            custom_fields = self.custom_fields.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "requestTypeId": request_type_id,
            "summary": summary,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if priority is not UNSET:
            field_dict["priority"] = priority
        if due_date is not UNSET:
            field_dict["dueDate"] = due_date
        if custom_fields is not UNSET:
            field_dict["customFields"] = custom_fields

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_portal_request_custom_fields import CreatePortalRequestCustomFields # noqa: PLC0415
        from ..models.rich_text import RichText # noqa: PLC0415
        from ..models.rich_text_input_type_1 import RichTextInputType1 # noqa: PLC0415
        d = dict(src_dict)
        request_type_id = UUID(d.pop("requestTypeId"))




        summary = d.pop("summary")

        def _parse_description(data: object) -> RichText | RichTextInputType1 | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_rich_text_input_type_0 = RichText.from_dict(data)



                return componentsschemas_rich_text_input_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_rich_text_input_type_1 = RichTextInputType1.from_dict(data)



            return componentsschemas_rich_text_input_type_1

        description = _parse_description(d.pop("description", UNSET))


        priority = d.pop("priority", UNSET)

        _due_date = d.pop("dueDate", UNSET)
        due_date: datetime.date | Unset
        if isinstance(_due_date,  Unset):
            due_date = UNSET
        else:
            due_date = datetime.date.fromisoformat(_due_date)




        _custom_fields = d.pop("customFields", UNSET)
        custom_fields: CreatePortalRequestCustomFields | Unset
        if isinstance(_custom_fields,  Unset):
            custom_fields = UNSET
        else:
            custom_fields = CreatePortalRequestCustomFields.from_dict(_custom_fields)




        create_portal_request = cls(
            request_type_id=request_type_id,
            summary=summary,
            description=description,
            priority=priority,
            due_date=due_date,
            custom_fields=custom_fields,
        )


        create_portal_request.additional_properties = d
        return create_portal_request

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
